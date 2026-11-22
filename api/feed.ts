import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq } from './_lib/auth.js';
import { ensureReady } from './_lib/db.js';
import { BASE_POST_SELECT, hydratePosts } from './_lib/hydrate.js';
import { getTimeCutoff, PostSort, sortPosts } from './_lib/ranking.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = await ensureReady();
    const session = getSessionFromReq(req);
    const viewerId = session?.userId || null;

    const feed = String(req.query.feed || 'home');
    const communityName = String(req.query.community || '').trim();
    const customFeedId = String(req.query.customFeedId || '').trim();
    const q = String(req.query.q || '').trim();
    const searchType = String(req.query.searchType || 'posts');
    const flair = String(req.query.flair || '').trim();
    const sort = (String(req.query.sort || 'hot') as PostSort);
    const timeRange = String(req.query.t || 'all');
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 60);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    // Non-post search tabs
    if (feed === 'search' && q) {
      const pattern = `%${q}%`;
      if (searchType === 'communities') {
        const rows = await sql`
          SELECT * FROM or_communities
          WHERE LOWER(name) LIKE LOWER(${pattern})
             OR LOWER(title) LIKE LOWER(${pattern})
             OR LOWER(description) LIKE LOWER(${pattern})
          ORDER BY member_count DESC
          LIMIT 50
        `;
        return res.status(200).json({
          communities: rows.map((c: any) => ({
            id: String(c.id),
            name: String(c.name),
            title: String(c.title),
            description: String(c.description || ''),
            category: String(c.category || 'General'),
            iconEmoji: String(c.icon_emoji || '🔥'),
            accentColor: String(c.accent_color || '#FF4500'),
            isNsfw: Boolean(c.is_nsfw),
            isUnmoderated: Boolean(c.is_unmoderated),
            memberCount: Number(c.member_count || 0),
          })),
        });
      }

      if (searchType === 'users') {
        const rows = await sql`
          SELECT id, username, display_name, bio, avatar_color, avatar_url,
                 post_karma, comment_karma, trophies, created_at
          FROM or_users
          WHERE LOWER(username) LIKE LOWER(${pattern})
             OR LOWER(display_name) LIKE LOWER(${pattern})
             OR LOWER(bio) LIKE LOWER(${pattern})
          ORDER BY (post_karma + comment_karma) DESC
          LIMIT 50
        `;
        return res.status(200).json({
          users: rows.map((u: any) => ({
            id: String(u.id),
            username: String(u.username),
            displayName: String(u.display_name || u.username),
            bio: String(u.bio || ''),
            avatarColor: String(u.avatar_color || '#FF4500'),
            avatarUrl: u.avatar_url ? String(u.avatar_url) : null,
            postKarma: Number(u.post_karma || 0),
            commentKarma: Number(u.comment_karma || 0),
            trophies: Array.isArray(u.trophies) ? u.trophies : [],
            createdAt: new Date(u.created_at).toISOString(),
          })),
        });
      }

      if (searchType === 'comments') {
        const rows = await sql`
          SELECT cm.*, u.username AS author_username, u.avatar_color AS author_avatar_color,
                 p.title AS post_title, p.community_id, c.name AS community_name
          FROM or_comments cm
          JOIN or_users u ON u.id = cm.author_id
          JOIN or_posts p ON p.id = cm.post_id
          JOIN or_communities c ON c.id = p.community_id
          WHERE cm.is_deleted = FALSE AND LOWER(cm.body) LIKE LOWER(${pattern})
          ORDER BY cm.score DESC, cm.created_at DESC
          LIMIT 50
        `;
        return res.status(200).json({
          comments: rows.map((r: any) => ({
            id: String(r.id),
            postId: String(r.post_id),
            postTitle: String(r.post_title),
            communityName: String(r.community_name),
            authorUsername: String(r.author_username),
            authorAvatarColor: String(r.author_avatar_color || '#FF4500'),
            body: String(r.body),
            score: Number(r.score || 0),
            createdAt: new Date(r.created_at).toISOString(),
          })),
        });
      }
    }

    const conditions: string[] = [];
    const params: any[] = [];
    const pushParam = (val: any) => {
      params.push(val);
      return `$${params.length}`;
    };

    const cutoff = getTimeCutoff(timeRange);
    if (cutoff) {
      conditions.push(`p.created_at >= ${pushParam(cutoff.toISOString())}`);
    }

    if (communityName) {
      conditions.push(`LOWER(c.name) = LOWER(${pushParam(communityName)})`);
    }

    if (flair) {
      conditions.push(`LOWER(p.flair->>'text') = LOWER(${pushParam(flair)})`);
    }

    if (q) {
      const pRef = pushParam(`%${q}%`);
      conditions.push(
        `(LOWER(p.title) LIKE LOWER(${pRef}) OR LOWER(p.body) LIKE LOWER(${pRef}) OR LOWER(c.name) LIKE LOWER(${pRef}))`
      );
    }

    if (feed === 'home' && viewerId) {
      const [subCount, followCount] = await Promise.all([
        sql`SELECT COUNT(*)::int AS cnt FROM or_community_members WHERE user_id = ${viewerId} AND is_banned = FALSE`,
        sql`SELECT COUNT(*)::int AS cnt FROM or_follows WHERE follower_id = ${viewerId}`,
      ]);
      const hasSubscriptions =
        Number(subCount[0]?.cnt ?? 0) > 0 || Number(followCount[0]?.cnt ?? 0) > 0;
      if (hasSubscriptions) {
        const uRef = pushParam(viewerId);
        conditions.push(`(
          p.community_id IN (SELECT community_id FROM or_community_members WHERE user_id = ${uRef} AND is_banned = FALSE)
          OR p.author_id IN (SELECT following_id FROM or_follows WHERE follower_id = ${uRef})
        )`);
      }
    } else if (feed === 'custom' && customFeedId) {
      const cfRows = await sql`
        SELECT community_ids FROM or_custom_feeds WHERE id = ${customFeedId} LIMIT 1
      `;
      const communityIds: string[] = Array.isArray(cfRows[0]?.community_ids)
        ? cfRows[0].community_ids
        : [];
      if (communityIds.length === 0) {
        return res.status(200).json({ posts: [], hasMore: false });
      }
      conditions.push(`p.community_id = ANY(${pushParam(communityIds)})`);
    } else if (feed === 'saved' && viewerId) {
      conditions.push(
        `p.id IN (SELECT target_id FROM or_saved WHERE user_id = ${pushParam(viewerId)} AND target_type = 'post')`
      );
    } else if (feed === 'hidden' && viewerId) {
      conditions.push(
        `p.id IN (SELECT post_id FROM or_hidden_posts WHERE user_id = ${pushParam(viewerId)})`
      );
    } else if (feed === 'upvoted' && viewerId) {
      conditions.push(
        `p.id IN (SELECT target_id FROM or_votes WHERE user_id = ${pushParam(viewerId)} AND target_type = 'post' AND value = 1)`
      );
    } else if (feed === 'downvoted' && viewerId) {
      conditions.push(
        `p.id IN (SELECT target_id FROM or_votes WHERE user_id = ${pushParam(viewerId)} AND target_type = 'post' AND value = -1)`
      );
    }

    if (viewerId && feed !== 'hidden') {
      conditions.push(
        `p.id NOT IN (SELECT post_id FROM or_hidden_posts WHERE user_id = ${pushParam(viewerId)})`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rawRows = await sql.query(
      `${BASE_POST_SELECT} ${whereClause} ORDER BY p.created_at DESC LIMIT 250`,
      params
    );

    const hydrated = await hydratePosts(sql, rawRows, viewerId);
    const respectPins = feed === 'community' || (feed === 'home' && !q);
    const sorted = sortPosts(hydrated, sort, respectPins);
    const paged = sorted.slice(offset, offset + limit);

    return res.status(200).json({
      posts: paged,
      total: sorted.length,
      hasMore: offset + limit < sorted.length,
    });
  } catch (err: any) {
    console.error('Feed API error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to load feed' });
  }
}
