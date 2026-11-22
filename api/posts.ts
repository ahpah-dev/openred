import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq, makeId, parseBody } from './_lib/auth.js';
import { createNotification, ensureReady } from './_lib/db.js';
import { BASE_POST_SELECT, hydratePosts } from './_lib/hydrate.js';
import { CommentSort, sortComments } from './_lib/ranking.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = await ensureReady();
    const session = getSessionFromReq(req);
    const viewerId = session?.userId || null;

    if (req.method === 'GET') {
      const postId = String(req.query.id || '').trim();
      const commentSort = (String(req.query.commentSort || 'best') as CommentSort);
      if (!postId) {
        return res.status(400).json({ error: 'Missing post id' });
      }

      const postRows = await sql.query(`${BASE_POST_SELECT} WHERE p.id = $1 LIMIT 1`, [
        postId,
      ]);
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const [post] = await hydratePosts(sql, postRows, viewerId);

      const commentRows = await sql`
        SELECT cm.*,
               u.username AS author_username,
               u.display_name AS author_display_name,
               u.avatar_color AS author_avatar_color,
               u.avatar_url AS author_avatar_url,
               mem.user_flair AS author_flair
        FROM or_comments cm
        JOIN or_users u ON u.id = cm.author_id
        LEFT JOIN or_community_members mem
          ON mem.community_id = ${post.communityId} AND mem.user_id = cm.author_id
        WHERE cm.post_id = ${postId}
        ORDER BY cm.created_at ASC
      `;

      let commentVotes: Record<string, number> = {};
      let savedComments = new Set<string>();
      if (viewerId && commentRows.length > 0) {
        const cIds = commentRows.map((c: any) => String(c.id));
        const [vRows, sRows] = await Promise.all([
          sql.query(
            `SELECT target_id, value FROM or_votes WHERE user_id = $1 AND target_type = 'comment' AND target_id = ANY($2)`,
            [viewerId, cIds]
          ),
          sql.query(
            `SELECT target_id FROM or_saved WHERE user_id = $1 AND target_type = 'comment' AND target_id = ANY($2)`,
            [viewerId, cIds]
          ),
        ]);
        for (const v of vRows) commentVotes[String(v.target_id)] = Number(v.value);
        for (const s of sRows) savedComments.add(String(s.target_id));
      }

      const formattedComments = commentRows.map((c: any) => ({
        id: String(c.id),
        postId: String(c.post_id),
        parentId: c.parent_id ? String(c.parent_id) : null,
        authorId: String(c.author_id),
        authorUsername: c.is_deleted ? '[deleted]' : String(c.author_username),
        authorDisplayName: c.is_deleted
          ? '[deleted]'
          : String(c.author_display_name || c.author_username),
        authorAvatarColor: String(c.author_avatar_color || '#64748B'),
        authorAvatarUrl: c.is_deleted || !c.author_avatar_url ? null : String(c.author_avatar_url),
        authorFlair: c.author_flair ? String(c.author_flair) : null,
        body: c.is_deleted ? '[deleted]' : String(c.body),
        upvotes: Number(c.upvotes ?? 1),
        downvotes: Number(c.downvotes ?? 0),
        score: Number(c.score ?? 1),
        isPinned: Boolean(c.is_pinned),
        isModDistinguished: Boolean(c.is_mod_distinguished),
        isDeleted: Boolean(c.is_deleted),
        awards: Array.isArray(c.awards) ? c.awards : [],
        editedAt: c.edited_at ? new Date(c.edited_at).toISOString() : null,
        createdAt: new Date(c.created_at).toISOString(),
        userVote: commentVotes[String(c.id)] || 0,
        isSaved: savedComments.has(String(c.id)),
      }));

      const sortedComments = sortComments(formattedComments, commentSort, post.authorId);

      return res.status(200).json({ post, comments: sortedComments });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!session) {
      return res.status(401).json({ error: 'Sign in required' });
    }

    const body = parseBody(req);
    const action = String(body.action || '');

    if (action === 'create') {
      const communityName = String(body.communityName || '').trim();
      const title = String(body.title || '').trim();
      const postType = String(body.postType || 'text');
      const content = String(body.body || '');
      const url = body.url ? String(body.url).trim() : null;
      const media = Array.isArray(body.media) ? body.media.slice(0, 10) : [];
      const crosspostOf = body.crosspostOf ? String(body.crosspostOf) : null;
      const flair = body.flair && body.flair.text ? body.flair : null;
      const isNsfw = Boolean(body.isNsfw);
      const isSpoiler = Boolean(body.isSpoiler);
      const isOc = Boolean(body.isOc);

      if (!communityName) {
        return res.status(400).json({ error: 'Please select a community' });
      }
      if (title.length < 2 || title.length > 300) {
        return res.status(400).json({ error: 'Title must be 2–300 characters' });
      }

      const commRows = await sql`
        SELECT id, is_nsfw FROM or_communities WHERE LOWER(name) = LOWER(${communityName}) LIMIT 1
      `;
      if (commRows.length === 0) {
        return res.status(404).json({ error: `r/${communityName} does not exist` });
      }
      const communityId = String(commRows[0].id);

      const banCheck = await sql`
        SELECT is_banned FROM or_community_members
        WHERE community_id = ${communityId} AND user_id = ${session.userId} LIMIT 1
      `;
      if (banCheck[0]?.is_banned) {
        return res.status(403).json({ error: 'You are banned from posting in this community.' });
      }

      if (url && !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: 'Link URL must start with http:// or https://' });
      }

      let pollData = null;
      if (postType === 'poll') {
        const rawOptions: string[] = Array.isArray(body.pollOptions)
          ? body.pollOptions.map((o: any) => String(o).trim()).filter(Boolean)
          : [];
        if (rawOptions.length < 2 || rawOptions.length > 6) {
          return res.status(400).json({ error: 'Polls require 2 to 6 options' });
        }
        const days = Math.min(Math.max(Number(body.pollDays || 7), 1), 14);
        pollData = {
          closesAt: new Date(Date.now() + days * 86400 * 1000).toISOString(),
          options: rawOptions.map((text, idx) => ({
            id: `opt_${idx + 1}`,
            text: text.slice(0, 120),
            votes: 0,
          })),
        };
      }

      const postId = makeId('post');
      await sql`
        INSERT INTO or_posts (
          id, community_id, author_id, title, post_type, body, url, media, poll_data,
          crosspost_of, flair, is_nsfw, is_spoiler, is_oc
        )
        VALUES (
          ${postId}, ${communityId}, ${session.userId}, ${title}, ${postType},
          ${content}, ${url}, ${JSON.stringify(media)}::jsonb,
          ${pollData ? JSON.stringify(pollData) : null}::jsonb,
          ${crosspostOf}, ${flair ? JSON.stringify(flair) : null}::jsonb,
          ${isNsfw || Boolean(commRows[0].is_nsfw)}, ${isSpoiler}, ${isOc}
        )
      `;

      await sql`
        INSERT INTO or_votes (user_id, target_type, target_id, value)
        VALUES (${session.userId}, 'post', ${postId}, 1)
      `;
      await sql`
        UPDATE or_users SET post_karma = post_karma + 1 WHERE id = ${session.userId}
      `;

      const createdRows = await sql.query(`${BASE_POST_SELECT} WHERE p.id = $1 LIMIT 1`, [
        postId,
      ]);
      const [post] = await hydratePosts(sql, createdRows, session.userId);
      return res.status(201).json({ post });
    }

    const postId = String(body.postId || '').trim();
    if (!postId) {
      return res.status(400).json({ error: 'Missing postId' });
    }

    if (action === 'edit') {
      const nextBody = String(body.body ?? '');
      const existing = await sql`SELECT author_id FROM or_posts WHERE id = ${postId} LIMIT 1`;
      if (existing.length === 0) return res.status(404).json({ error: 'Post not found' });
      if (String(existing[0].author_id) !== session.userId) {
        return res.status(403).json({ error: 'Only the author can edit this post' });
      }
      await sql`
        UPDATE or_posts SET body = ${nextBody}, edited_at = NOW() WHERE id = ${postId}
      `;
      return res.status(200).json({ ok: true, body: nextBody, editedAt: new Date().toISOString() });
    }

    if (action === 'delete') {
      const existing = await sql`SELECT author_id FROM or_posts WHERE id = ${postId} LIMIT 1`;
      if (existing.length === 0) return res.status(404).json({ error: 'Post not found' });
      if (String(existing[0].author_id) !== session.userId) {
        return res.status(403).json({ error: 'Only the author can delete this post' });
      }
      await Promise.all([
        sql`DELETE FROM or_comments WHERE post_id = ${postId}`,
        sql`DELETE FROM or_votes WHERE target_type = 'post' AND target_id = ${postId}`,
        sql`DELETE FROM or_saved WHERE target_type = 'post' AND target_id = ${postId}`,
        sql`DELETE FROM or_hidden_posts WHERE post_id = ${postId}`,
        sql`DELETE FROM or_poll_votes WHERE post_id = ${postId}`,
        sql`DELETE FROM or_posts WHERE id = ${postId}`,
      ]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'pollVote') {
      const optionId = String(body.optionId || '');
      const rows = await sql`SELECT poll_data FROM or_posts WHERE id = ${postId} LIMIT 1`;
      if (rows.length === 0 || !rows[0].poll_data) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      const pollData = rows[0].poll_data as {
        closesAt?: string;
        options: Array<{ id: string; text: string; votes: number }>;
      };
      if (!pollData.options.some((o) => o.id === optionId)) {
        return res.status(400).json({ error: 'Invalid poll option' });
      }

      const prevVote = await sql`
        SELECT option_id FROM or_poll_votes WHERE post_id = ${postId} AND user_id = ${session.userId} LIMIT 1
      `;
      const prevOptId = prevVote[0]?.option_id ? String(prevVote[0].option_id) : null;

      if (prevOptId !== optionId) {
        pollData.options = pollData.options.map((o) => {
          let votes = o.votes;
          if (prevOptId && o.id === prevOptId) votes = Math.max(0, votes - 1);
          if (o.id === optionId) votes += 1;
          return { ...o, votes };
        });

        await sql`
          INSERT INTO or_poll_votes (post_id, user_id, option_id)
          VALUES (${postId}, ${session.userId}, ${optionId})
          ON CONFLICT (post_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id
        `;
        await sql`
          UPDATE or_posts SET poll_data = ${JSON.stringify(pollData)}::jsonb WHERE id = ${postId}
        `;
      }

      return res.status(200).json({ pollData, userPollVote: optionId });
    }

    if (action === 'save' || action === 'unsave') {
      if (action === 'save') {
        await sql`
          INSERT INTO or_saved (user_id, target_type, target_id)
          VALUES (${session.userId}, 'post', ${postId})
          ON CONFLICT DO NOTHING
        `;
      } else {
        await sql`
          DELETE FROM or_saved WHERE user_id = ${session.userId} AND target_type = 'post' AND target_id = ${postId}
        `;
      }
      return res.status(200).json({ isSaved: action === 'save' });
    }

    if (action === 'hide' || action === 'unhide') {
      if (action === 'hide') {
        await sql`
          INSERT INTO or_hidden_posts (user_id, post_id)
          VALUES (${session.userId}, ${postId})
          ON CONFLICT DO NOTHING
        `;
      } else {
        await sql`
          DELETE FROM or_hidden_posts WHERE user_id = ${session.userId} AND post_id = ${postId}
        `;
      }
      return res.status(200).json({ isHidden: action === 'hide' });
    }

    if (action === 'award') {
      const awardId = String(body.awardId || '').trim();
      const allowedAwards = new Set([
        'torch',
        'gold',
        'silver',
        'helpful',
        'mindblown',
        'wholesome',
        'based',
        'classic',
      ]);
      if (!allowedAwards.has(awardId)) {
        return res.status(400).json({ error: 'Invalid award' });
      }
      const rows = await sql`
        SELECT p.awards, p.author_id, p.title, c.name AS community_name
        FROM or_posts p
        JOIN or_communities c ON c.id = p.community_id
        WHERE p.id = ${postId} LIMIT 1
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });

      const current: Array<{ id: string; count: number }> = Array.isArray(rows[0].awards)
        ? rows[0].awards
        : [];
      const found = current.find((a) => a.id === awardId);
      const next = found
        ? current.map((a) => (a.id === awardId ? { ...a, count: a.count + 1 } : a))
        : [...current, { id: awardId, count: 1 }];

      await sql`
        UPDATE or_posts SET awards = ${JSON.stringify(next)}::jsonb WHERE id = ${postId}
      `;
      await sql`
        UPDATE or_users SET post_karma = post_karma + 5 WHERE id = ${String(rows[0].author_id)}
      `;
      await createNotification(sql, {
        id: makeId('ntf'),
        userId: String(rows[0].author_id),
        actorId: session.userId,
        type: 'award',
        title: `u/${session.username} gave your post an award!`,
        body: String(rows[0].title).slice(0, 120),
        link: `/r/${String(rows[0].community_name)}/comments/${postId}`,
      });

      return res.status(200).json({ awards: next });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err: any) {
    console.error('Posts API error:', err);
    return res.status(500).json({ error: err?.message || 'Post request failed' });
  }
}
