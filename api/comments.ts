import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq, makeId, parseBody } from './_lib/auth.js';
import {
  createNotification,
  ensureReady,
  getUserNotificationsAndMentions,
} from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = await ensureReady();
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Sign in required' });
    }

    const body = parseBody(req);
    const action = String(body.action || '');

    if (action === 'create') {
      const postId = String(body.postId || '').trim();
      const parentId = body.parentId ? String(body.parentId).trim() : null;
      const content = String(body.body || '').trim();

      if (!postId) return res.status(400).json({ error: 'Missing postId' });
      if (!content || content.length > 10000) {
        return res.status(400).json({ error: 'Comment must be 1–10,000 characters' });
      }

      const postRows = await sql`
        SELECT p.id, p.author_id, p.community_id, p.title, p.is_locked, c.name AS community_name
        FROM or_posts p
        JOIN or_communities c ON c.id = p.community_id
        WHERE p.id = ${postId} LIMIT 1
      `;
      if (postRows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const post = postRows[0];
      if (post.is_locked) {
        return res.status(403).json({ error: 'This thread is locked by moderators.' });
      }

      const banCheck = await sql`
        SELECT is_banned, user_flair FROM or_community_members
        WHERE community_id = ${String(post.community_id)} AND user_id = ${session.userId} LIMIT 1
      `;
      if (banCheck[0]?.is_banned) {
        return res.status(403).json({ error: 'You are banned from commenting in this community.' });
      }

      let parentAuthorId: string | null = null;
      if (parentId) {
        const parentRows = await sql`
          SELECT author_id FROM or_comments WHERE id = ${parentId} AND post_id = ${postId} LIMIT 1
        `;
        if (parentRows.length === 0) {
          return res.status(404).json({ error: 'Parent comment not found' });
        }
        parentAuthorId = String(parentRows[0].author_id);
      }

      const commentId = makeId('cmt');
      await sql`
        INSERT INTO or_comments (id, post_id, parent_id, author_id, body)
        VALUES (${commentId}, ${postId}, ${parentId}, ${session.userId}, ${content})
      `;
      await sql`
        INSERT INTO or_votes (user_id, target_type, target_id, value)
        VALUES (${session.userId}, 'comment', ${commentId}, 1)
      `;
      await sql`
        UPDATE or_posts SET comment_count = comment_count + 1 WHERE id = ${postId}
      `;
      await sql`
        UPDATE or_users SET comment_karma = comment_karma + 1 WHERE id = ${session.userId}
      `;

      const link = `/r/${String(post.community_name)}/comments/${postId}`;
      const snippet = content.slice(0, 140);

      if (parentAuthorId) {
        await createNotification(sql, {
          id: makeId('ntf'),
          userId: parentAuthorId,
          actorId: session.userId,
          type: 'comment_reply',
          title: `u/${session.username} replied to your comment in r/${String(post.community_name)}`,
          body: snippet,
          link,
        });
      } else {
        await createNotification(sql, {
          id: makeId('ntf'),
          userId: String(post.author_id),
          actorId: session.userId,
          type: 'post_reply',
          title: `u/${session.username} commented on "${String(post.title).slice(0, 60)}"`,
          body: snippet,
          link,
        });
      }

      const mentionedIds = await getUserNotificationsAndMentions(sql, content);
      for (const uid of mentionedIds) {
        if (uid !== parentAuthorId && uid !== String(post.author_id)) {
          await createNotification(sql, {
            id: makeId('ntf'),
            userId: uid,
            actorId: session.userId,
            type: 'mention',
            title: `u/${session.username} mentioned you in r/${String(post.community_name)}`,
            body: snippet,
            link,
          });
        }
      }

      const userRows = await sql`
        SELECT username, display_name, avatar_color, avatar_url FROM or_users WHERE id = ${session.userId} LIMIT 1
      `;
      const u = userRows[0];

      return res.status(201).json({
        comment: {
          id: commentId,
          postId,
          parentId,
          authorId: session.userId,
          authorUsername: String(u.username),
          authorDisplayName: String(u.display_name || u.username),
          authorAvatarColor: String(u.avatar_color || '#FF4500'),
          authorAvatarUrl: u.avatar_url ? String(u.avatar_url) : null,
          authorFlair: banCheck[0]?.user_flair ? String(banCheck[0].user_flair) : null,
          body: content,
          upvotes: 1,
          downvotes: 0,
          score: 1,
          isPinned: false,
          isModDistinguished: false,
          isDeleted: false,
          awards: [],
          editedAt: null,
          createdAt: new Date().toISOString(),
          userVote: 1,
          isSaved: false,
        },
      });
    }

    const commentId = String(body.commentId || '').trim();
    if (!commentId) return res.status(400).json({ error: 'Missing commentId' });

    if (action === 'edit') {
      const nextBody = String(body.body || '').trim();
      if (!nextBody) return res.status(400).json({ error: 'Comment cannot be empty' });
      const rows = await sql`SELECT author_id, is_deleted FROM or_comments WHERE id = ${commentId} LIMIT 1`;
      if (rows.length === 0 || rows[0].is_deleted) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      if (String(rows[0].author_id) !== session.userId) {
        return res.status(403).json({ error: 'Only the author can edit this comment' });
      }
      await sql`
        UPDATE or_comments SET body = ${nextBody}, edited_at = NOW() WHERE id = ${commentId}
      `;
      return res.status(200).json({ ok: true, body: nextBody, editedAt: new Date().toISOString() });
    }

    if (action === 'delete') {
      const rows = await sql`SELECT author_id FROM or_comments WHERE id = ${commentId} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
      if (String(rows[0].author_id) !== session.userId) {
        return res.status(403).json({ error: 'Only the author can delete this comment' });
      }
      await sql`
        UPDATE or_comments SET is_deleted = TRUE, body = '[deleted]' WHERE id = ${commentId}
      `;
      return res.status(200).json({ ok: true });
    }

    if (action === 'save' || action === 'unsave') {
      if (action === 'save') {
        await sql`
          INSERT INTO or_saved (user_id, target_type, target_id)
          VALUES (${session.userId}, 'comment', ${commentId})
          ON CONFLICT DO NOTHING
        `;
      } else {
        await sql`
          DELETE FROM or_saved WHERE user_id = ${session.userId} AND target_type = 'comment' AND target_id = ${commentId}
        `;
      }
      return res.status(200).json({ isSaved: action === 'save' });
    }

    if (action === 'award') {
      const awardId = String(body.awardId || '').trim();
      const rows = await sql`
        SELECT cm.awards, cm.author_id, cm.body, cm.post_id, c.name AS community_name
        FROM or_comments cm
        JOIN or_posts p ON p.id = cm.post_id
        JOIN or_communities c ON c.id = p.community_id
        WHERE cm.id = ${commentId} LIMIT 1
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

      const current: Array<{ id: string; count: number }> = Array.isArray(rows[0].awards)
        ? rows[0].awards
        : [];
      const found = current.find((a) => a.id === awardId);
      const next = found
        ? current.map((a) => (a.id === awardId ? { ...a, count: a.count + 1 } : a))
        : [...current, { id: awardId, count: 1 }];

      await sql`
        UPDATE or_comments SET awards = ${JSON.stringify(next)}::jsonb WHERE id = ${commentId}
      `;
      await sql`
        UPDATE or_users SET comment_karma = comment_karma + 5 WHERE id = ${String(rows[0].author_id)}
      `;
      await createNotification(sql, {
        id: makeId('ntf'),
        userId: String(rows[0].author_id),
        actorId: session.userId,
        type: 'award',
        title: `u/${session.username} gave your comment an award!`,
        body: String(rows[0].body).slice(0, 120),
        link: `/r/${String(rows[0].community_name)}/comments/${String(rows[0].post_id)}`,
      });
      return res.status(200).json({ awards: next });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err: any) {
    console.error('Comments API error:', err);
    return res.status(500).json({ error: err?.message || 'Comment request failed' });
  }
}
