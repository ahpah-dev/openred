import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq, makeId, parseBody } from './_lib/auth.js';
import { addModLog, ensureReady } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = await ensureReady();

    if (req.method === 'GET') {
      const communityName = String(req.query.community || '').trim();
      const actionFilter = String(req.query.action || '').trim();
      const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 150);

      const conditions: string[] = [];
      const params: any[] = [];
      if (communityName) {
        params.push(communityName);
        conditions.push(`LOWER(c.name) = LOWER($${params.length})`);
      }
      if (actionFilter) {
        params.push(actionFilter);
        conditions.push(`l.action = $${params.length}`);
      }
      params.push(limit);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await sql.query(
        `SELECT l.*, c.name AS community_name, c.icon_emoji AS community_icon_emoji,
                u.username AS moderator_username, u.avatar_color AS moderator_avatar_color
         FROM or_mod_logs l
         JOIN or_communities c ON c.id = l.community_id
         JOIN or_users u ON u.id = l.moderator_id
         ${whereClause}
         ORDER BY l.created_at DESC
         LIMIT $${params.length}`,
        params
      );

      return res.status(200).json({
        logs: rows.map((r: any) => ({
          id: String(r.id),
          communityId: String(r.community_id),
          communityName: String(r.community_name),
          communityIconEmoji: String(r.community_icon_emoji || '🔥'),
          moderatorId: String(r.moderator_id),
          moderatorUsername: String(r.moderator_username),
          moderatorAvatarColor: String(r.moderator_avatar_color || '#FF4500'),
          action: String(r.action),
          targetId: r.target_id ? String(r.target_id) : null,
          targetSummary: String(r.target_summary || ''),
          reason: String(r.reason || ''),
          createdAt: new Date(r.created_at).toISOString(),
        })),
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = getSessionFromReq(req);
    if (!session) return res.status(401).json({ error: 'Sign in required' });

    const body = parseBody(req);
    const action = String(body.action || '');
    const reason = String(body.reason || 'Moderator action').trim().slice(0, 300);

    let communityId = body.communityId ? String(body.communityId) : '';
    const postId = body.postId ? String(body.postId) : '';
    const commentId = body.commentId ? String(body.commentId) : '';

    let postRow: any = null;
    let commentRow: any = null;

    if (postId) {
      const pRows = await sql`SELECT * FROM or_posts WHERE id = ${postId} LIMIT 1`;
      if (pRows.length === 0) return res.status(404).json({ error: 'Post not found' });
      postRow = pRows[0];
      communityId = String(postRow.community_id);
    } else if (commentId) {
      const cRows = await sql`
        SELECT cm.*, p.community_id, p.title AS post_title
        FROM or_comments cm
        JOIN or_posts p ON p.id = cm.post_id
        WHERE cm.id = ${commentId} LIMIT 1
      `;
      if (cRows.length === 0) return res.status(404).json({ error: 'Comment not found' });
      commentRow = cRows[0];
      communityId = String(commentRow.community_id);
    }

    if (!communityId) {
      return res.status(400).json({ error: 'Missing communityId, postId, or commentId' });
    }

    const [commRows, memRows, userRows] = await Promise.all([
      sql`SELECT * FROM or_communities WHERE id = ${communityId} LIMIT 1`,
      sql`
        SELECT role FROM or_community_members
        WHERE community_id = ${communityId} AND user_id = ${session.userId} LIMIT 1
      `,
      sql`SELECT is_admin FROM or_users WHERE id = ${session.userId} LIMIT 1`,
    ]);

    if (commRows.length === 0) return res.status(404).json({ error: 'Community not found' });
    const comm = commRows[0];
    const isMod = memRows[0]?.role === 'owner' || memRows[0]?.role === 'mod';
    const isAdmin = Boolean(userRows[0]?.is_admin);

    if (!isMod && !isAdmin) {
      return res.status(403).json({ error: 'Community moderator privileges required' });
    }

    if (
      Boolean(comm.is_unmoderated) &&
      ['removePost', 'banUser', 'lockPost'].includes(action)
    ) {
      return res.status(403).json({
        error: `r/${String(comm.name)} is a Zero-Moderation Free-Speech Zone: removals, thread locks, and bans are disabled.`,
      });
    }

    if ((action === 'pinPost' || action === 'unpinPost') && postRow) {
      const nextVal = action === 'pinPost';
      await sql`UPDATE or_posts SET is_pinned = ${nextVal} WHERE id = ${postId}`;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: nextVal ? 'PIN_POST' : 'UNPIN_POST',
        targetId: postId,
        targetSummary: String(postRow.title).slice(0, 120),
        reason,
      });
      return res.status(200).json({ isPinned: nextVal });
    }

    if ((action === 'lockPost' || action === 'unlockPost') && postRow) {
      const nextVal = action === 'lockPost';
      await sql`UPDATE or_posts SET is_locked = ${nextVal} WHERE id = ${postId}`;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: nextVal ? 'LOCK_POST' : 'UNLOCK_POST',
        targetId: postId,
        targetSummary: String(postRow.title).slice(0, 120),
        reason,
      });
      return res.status(200).json({ isLocked: nextVal });
    }

    if (action === 'toggleNsfw' && postRow) {
      const nextVal = !Boolean(postRow.is_nsfw);
      await sql`UPDATE or_posts SET is_nsfw = ${nextVal} WHERE id = ${postId}`;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: nextVal ? 'MARK_NSFW' : 'UNMARK_NSFW',
        targetId: postId,
        targetSummary: String(postRow.title).slice(0, 120),
        reason,
      });
      return res.status(200).json({ isNsfw: nextVal });
    }

    if (action === 'toggleSpoiler' && postRow) {
      const nextVal = !Boolean(postRow.is_spoiler);
      await sql`UPDATE or_posts SET is_spoiler = ${nextVal} WHERE id = ${postId}`;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: nextVal ? 'MARK_SPOILER' : 'UNMARK_SPOILER',
        targetId: postId,
        targetSummary: String(postRow.title).slice(0, 120),
        reason,
      });
      return res.status(200).json({ isSpoiler: nextVal });
    }

    if (action === 'removePost' && postRow) {
      if (!body.reason || String(body.reason).trim().length < 3) {
        return res.status(400).json({
          error: 'Public transparency requires a visible reason (3+ chars) to remove a post.',
        });
      }
      await sql`
        UPDATE or_posts SET is_removed = TRUE, removed_reason = ${reason} WHERE id = ${postId}
      `;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: 'REMOVE_POST',
        targetId: postId,
        targetSummary: String(postRow.title).slice(0, 120),
        reason,
      });
      return res.status(200).json({ isRemoved: true, removedReason: reason });
    }

    if (action === 'restorePost' && postRow) {
      await sql`
        UPDATE or_posts SET is_removed = FALSE, removed_reason = NULL WHERE id = ${postId}
      `;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: 'RESTORE_POST',
        targetId: postId,
        targetSummary: String(postRow.title).slice(0, 120),
        reason,
      });
      return res.status(200).json({ isRemoved: false, removedReason: null });
    }

    if ((action === 'pinComment' || action === 'unpinComment') && commentRow) {
      const nextVal = action === 'pinComment';
      await sql`UPDATE or_comments SET is_pinned = ${nextVal} WHERE id = ${commentId}`;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: nextVal ? 'PIN_COMMENT' : 'UNPIN_COMMENT',
        targetId: commentId,
        targetSummary: String(commentRow.body).slice(0, 100),
        reason,
      });
      return res.status(200).json({ isPinned: nextVal });
    }

    if (action === 'distinguishComment' && commentRow) {
      const nextVal = !Boolean(commentRow.is_mod_distinguished);
      await sql`
        UPDATE or_comments SET is_mod_distinguished = ${nextVal} WHERE id = ${commentId}
      `;
      return res.status(200).json({ isModDistinguished: nextVal });
    }

    if (action === 'banUser' || action === 'unbanUser') {
      const targetUsername = String(body.username || '').trim();
      const targetUsers = await sql`
        SELECT id, username FROM or_users WHERE LOWER(username) = LOWER(${targetUsername}) LIMIT 1
      `;
      if (targetUsers.length === 0) return res.status(404).json({ error: 'User not found' });
      const targetId = String(targetUsers[0].id);
      const isBan = action === 'banUser';

      await sql`
        INSERT INTO or_community_members (community_id, user_id, role, is_banned)
        VALUES (${communityId}, ${targetId}, 'member', ${isBan})
        ON CONFLICT (community_id, user_id) DO UPDATE SET is_banned = ${isBan}
      `;
      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: isBan ? 'BAN_USER' : 'UNBAN_USER',
        targetId,
        targetSummary: `u/${String(targetUsers[0].username)}`,
        reason,
      });
      return res.status(200).json({ ok: true, isBanned: isBan });
    }

    return res.status(400).json({ error: 'Unknown mod action' });
  } catch (err: any) {
    console.error('Mod API error:', err);
    return res.status(500).json({ error: err?.message || 'Moderation action failed' });
  }
}
