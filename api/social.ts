import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq, makeId, parseBody } from './_lib/auth.js';
import { createNotification, ensureReady } from './_lib/db.js';
import { BASE_POST_SELECT, hydratePosts } from './_lib/hydrate.js';

export function buildDmRoomId(userA: string, userB: string): string {
  const [first, second] = [userA, userB].sort();
  return `dm:${first}:${second}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = await ensureReady();
    const session = getSessionFromReq(req);
    const viewerId = session?.userId || null;

    if (req.method === 'GET') {
      const resource = String(req.query.resource || '');

      if (resource === 'profile') {
        const username = String(req.query.username || '').trim();
        if (!username) return res.status(400).json({ error: 'Missing username' });

        const uRows = await sql`
          SELECT id, username, display_name, bio, avatar_color, avatar_url, banner_color,
                 post_karma, comment_karma, trophies, is_admin, created_at
          FROM or_users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
        `;
        if (uRows.length === 0) {
          return res.status(404).json({ error: `u/${username} not found` });
        }
        const u = uRows[0];
        const profileId = String(u.id);
        const isSelf = viewerId === profileId;

        const [postRows, commentRows, followerCountRows, followingCountRows, followCheck] =
          await Promise.all([
            sql.query(
              `${BASE_POST_SELECT} WHERE p.author_id = $1 ORDER BY p.created_at DESC LIMIT 60`,
              [profileId]
            ),
            sql`
              SELECT cm.*, p.title AS post_title, c.name AS community_name
              FROM or_comments cm
              JOIN or_posts p ON p.id = cm.post_id
              JOIN or_communities c ON c.id = p.community_id
              WHERE cm.author_id = ${profileId} AND cm.is_deleted = FALSE
              ORDER BY cm.created_at DESC
              LIMIT 60
            `,
            sql`SELECT COUNT(*)::int AS cnt FROM or_follows WHERE following_id = ${profileId}`,
            sql`SELECT COUNT(*)::int AS cnt FROM or_follows WHERE follower_id = ${profileId}`,
            viewerId && !isSelf
              ? sql`SELECT 1 FROM or_follows WHERE follower_id = ${viewerId} AND following_id = ${profileId} LIMIT 1`
              : Promise.resolve([]),
          ]);

        const posts = await hydratePosts(sql, postRows, viewerId);

        let savedPosts: any[] = [];
        let savedComments: any[] = [];
        let upvotedPosts: any[] = [];
        let downvotedPosts: any[] = [];
        let hiddenPosts: any[] = [];

        if (isSelf && viewerId) {
          const [sPostRows, sCommRows, upRows, downRows, hidRows] = await Promise.all([
            sql.query(
              `${BASE_POST_SELECT} WHERE p.id IN (SELECT target_id FROM or_saved WHERE user_id = $1 AND target_type = 'post') ORDER BY p.created_at DESC LIMIT 50`,
              [viewerId]
            ),
            sql`
              SELECT cm.*, p.title AS post_title, c.name AS community_name,
                     u2.username AS author_username
              FROM or_comments cm
              JOIN or_posts p ON p.id = cm.post_id
              JOIN or_communities c ON c.id = p.community_id
              JOIN or_users u2 ON u2.id = cm.author_id
              WHERE cm.id IN (
                SELECT target_id FROM or_saved WHERE user_id = ${viewerId} AND target_type = 'comment'
              )
              ORDER BY cm.created_at DESC LIMIT 50
            `,
            sql.query(
              `${BASE_POST_SELECT} WHERE p.id IN (SELECT target_id FROM or_votes WHERE user_id = $1 AND target_type = 'post' AND value = 1) ORDER BY p.created_at DESC LIMIT 50`,
              [viewerId]
            ),
            sql.query(
              `${BASE_POST_SELECT} WHERE p.id IN (SELECT target_id FROM or_votes WHERE user_id = $1 AND target_type = 'post' AND value = -1) ORDER BY p.created_at DESC LIMIT 50`,
              [viewerId]
            ),
            sql.query(
              `${BASE_POST_SELECT} WHERE p.id IN (SELECT post_id FROM or_hidden_posts WHERE user_id = $1) ORDER BY p.created_at DESC LIMIT 50`,
              [viewerId]
            ),
          ]);
          [savedPosts, upvotedPosts, downvotedPosts, hiddenPosts] = await Promise.all([
            hydratePosts(sql, sPostRows, viewerId),
            hydratePosts(sql, upRows, viewerId),
            hydratePosts(sql, downRows, viewerId),
            hydratePosts(sql, hidRows, viewerId),
          ]);
          savedComments = sCommRows.map((c: any) => ({
            id: String(c.id),
            postId: String(c.post_id),
            postTitle: String(c.post_title),
            communityName: String(c.community_name),
            authorUsername: String(c.author_username),
            body: String(c.body),
            score: Number(c.score || 0),
            createdAt: new Date(c.created_at).toISOString(),
          }));
        }

        return res.status(200).json({
          profile: {
            id: profileId,
            username: String(u.username),
            displayName: String(u.display_name || u.username),
            bio: String(u.bio || ''),
            avatarColor: String(u.avatar_color || '#FF4500'),
            avatarUrl: u.avatar_url ? String(u.avatar_url) : null,
            bannerColor: String(u.banner_color || '#1A282D'),
            postKarma: Number(u.post_karma || 0),
            commentKarma: Number(u.comment_karma || 0),
            trophies: Array.isArray(u.trophies) ? u.trophies : [],
            isAdmin: Boolean(u.is_admin),
            createdAt: new Date(u.created_at).toISOString(),
            followersCount: Number(followerCountRows[0]?.cnt ?? 0),
            followingCount: Number(followingCountRows[0]?.cnt ?? 0),
            isFollowing: followCheck.length > 0,
            isSelf,
          },
          posts,
          comments: commentRows.map((c: any) => ({
            id: String(c.id),
            postId: String(c.post_id),
            postTitle: String(c.post_title),
            communityName: String(c.community_name),
            authorUsername: String(u.username),
            body: String(c.body),
            score: Number(c.score || 0),
            createdAt: new Date(c.created_at).toISOString(),
          })),
          savedPosts,
          savedComments,
          upvotedPosts,
          downvotedPosts,
          hiddenPosts,
        });
      }

      if (resource === 'notifications') {
        if (!session) return res.status(401).json({ error: 'Sign in required' });
        const rows = await sql`
          SELECT n.*, u.username AS actor_username, u.avatar_color AS actor_avatar_color
          FROM or_notifications n
          LEFT JOIN or_users u ON u.id = n.actor_id
          WHERE n.user_id = ${session.userId}
          ORDER BY n.created_at DESC
          LIMIT 60
        `;
        return res.status(200).json({
          notifications: rows.map((r: any) => ({
            id: String(r.id),
            type: String(r.type),
            title: String(r.title),
            body: String(r.body || ''),
            link: String(r.link || '/'),
            isRead: Boolean(r.is_read),
            actorUsername: r.actor_username ? String(r.actor_username) : null,
            actorAvatarColor: r.actor_avatar_color ? String(r.actor_avatar_color) : '#FF4500',
            createdAt: new Date(r.created_at).toISOString(),
          })),
        });
      }

      if (resource === 'messages') {
        let roomId = String(req.query.roomId || 'global:lobby');
        const peerUsername = String(req.query.peerUsername || '').trim();

        if (peerUsername) {
          if (!session) return res.status(401).json({ error: 'Sign in required for direct messages' });
          const peerRows = await sql`
            SELECT id, username FROM or_users WHERE LOWER(username) = LOWER(${peerUsername}) LIMIT 1
          `;
          if (peerRows.length === 0) {
            return res.status(404).json({ error: `u/${peerUsername} not found` });
          }
          roomId = buildDmRoomId(session.userId, String(peerRows[0].id));
        }

        if (roomId.startsWith('dm:')) {
          if (!session) return res.status(401).json({ error: 'Sign in required for direct messages' });
          const parts = roomId.split(':');
          if (!parts.includes(session.userId)) {
            return res.status(403).json({ error: 'Not a participant in this chat room' });
          }
        }

        const msgRows = await sql`
          SELECT m.*, u.username AS sender_username, u.avatar_color AS sender_avatar_color
          FROM or_messages m
          JOIN or_users u ON u.id = m.sender_id
          WHERE m.room_id = ${roomId}
          ORDER BY m.created_at ASC
          LIMIT 100
        `;

        let rooms: any[] = [
          {
            roomId: 'global:lobby',
            label: '#openred-lobby',
            subtitle: 'Global uncensored chat',
            isGlobal: true,
          },
        ];

        if (session) {
          const dmRows = await sql`
            SELECT DISTINCT m.room_id,
              CASE WHEN m.sender_id = ${session.userId} THEN m.recipient_id ELSE m.sender_id END AS peer_id
            FROM or_messages m
            WHERE m.room_id LIKE 'dm:%' AND (m.sender_id = ${session.userId} OR m.recipient_id = ${session.userId})
          `;
          const peerIds = Array.from(
            new Set(dmRows.map((d: any) => d.peer_id).filter(Boolean).map(String))
          );
          if (roomId.startsWith('dm:')) {
            const p = roomId.split(':').filter((x) => x !== 'dm' && x !== session.userId)[0];
            if (p && !peerIds.includes(p)) peerIds.push(p);
          }

          if (peerIds.length > 0) {
            const peers = await sql.query(
              `SELECT id, username, display_name, avatar_color FROM or_users WHERE id = ANY($1)`,
              [peerIds]
            );
            for (const peer of peers) {
              rooms.push({
                roomId: buildDmRoomId(session.userId, String(peer.id)),
                label: `u/${String(peer.username)}`,
                subtitle: String(peer.display_name || peer.username),
                peerId: String(peer.id),
                peerUsername: String(peer.username),
                avatarColor: String(peer.avatar_color || '#FF4500'),
                isGlobal: false,
              });
            }
          }
        }

        return res.status(200).json({
          roomId,
          rooms,
          messages: msgRows.map((m: any) => ({
            id: String(m.id),
            roomId: String(m.room_id),
            senderId: String(m.sender_id),
            senderUsername: String(m.sender_username),
            senderAvatarColor: String(m.sender_avatar_color || '#FF4500'),
            body: String(m.body),
            createdAt: new Date(m.created_at).toISOString(),
          })),
        });
      }

      if (resource === 'customFeeds') {
        if (!session) return res.status(200).json({ customFeeds: [] });
        const rows = await sql`
          SELECT * FROM or_custom_feeds WHERE user_id = ${session.userId} ORDER BY created_at DESC
        `;
        return res.status(200).json({
          customFeeds: rows.map((f: any) => ({
            id: String(f.id),
            name: String(f.name),
            description: String(f.description || ''),
            communityIds: Array.isArray(f.community_ids) ? f.community_ids : [],
            createdAt: new Date(f.created_at).toISOString(),
          })),
        });
      }

      return res.status(400).json({ error: 'Unknown resource' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!session) {
      return res.status(401).json({ error: 'Sign in required' });
    }

    const body = parseBody(req);
    const action = String(body.action || '');

    if (action === 'follow' || action === 'unfollow') {
      const targetUserId = String(body.targetUserId || '').trim();
      if (!targetUserId || targetUserId === session.userId) {
        return res.status(400).json({ error: 'Invalid user' });
      }
      if (action === 'follow') {
        await sql`
          INSERT INTO or_follows (follower_id, following_id)
          VALUES (${session.userId}, ${targetUserId})
          ON CONFLICT DO NOTHING
        `;
        await createNotification(sql, {
          id: makeId('ntf'),
          userId: targetUserId,
          actorId: session.userId,
          type: 'follow',
          title: `u/${session.username} started following you`,
          body: 'You can view their profile or start a chat.',
          link: `/u/${session.username}`,
        });
      } else {
        await sql`
          DELETE FROM or_follows WHERE follower_id = ${session.userId} AND following_id = ${targetUserId}
        `;
      }
      return res.status(200).json({ isFollowing: action === 'follow' });
    }

    if (action === 'markNotificationsRead') {
      const notificationId = body.notificationId ? String(body.notificationId) : null;
      if (notificationId) {
        await sql`
          UPDATE or_notifications SET is_read = TRUE
          WHERE id = ${notificationId} AND user_id = ${session.userId}
        `;
      } else {
        await sql`
          UPDATE or_notifications SET is_read = TRUE WHERE user_id = ${session.userId}
        `;
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'sendMessage') {
      const content = String(body.body || '').trim();
      if (!content || content.length > 2000) {
        return res.status(400).json({ error: 'Message must be 1–2,000 characters' });
      }
      let roomId = String(body.roomId || 'global:lobby');
      let recipientId: string | null = null;

      if (body.recipientUsername) {
        const peer = await sql`
          SELECT id FROM or_users WHERE LOWER(username) = LOWER(${String(body.recipientUsername)}) LIMIT 1
        `;
        if (peer.length === 0) return res.status(404).json({ error: 'Recipient not found' });
        recipientId = String(peer[0].id);
        roomId = buildDmRoomId(session.userId, recipientId);
      } else if (roomId.startsWith('dm:')) {
        const parts = roomId.split(':').filter((p) => p !== 'dm');
        if (!parts.includes(session.userId)) {
          return res.status(403).json({ error: 'Unauthorized chat room' });
        }
        recipientId = parts.find((p) => p !== session.userId) || session.userId;
      }

      const msgId = makeId('msg');
      await sql`
        INSERT INTO or_messages (id, room_id, sender_id, recipient_id, body)
        VALUES (${msgId}, ${roomId}, ${session.userId}, ${recipientId}, ${content})
      `;

      if (recipientId && recipientId !== session.userId) {
        await createNotification(sql, {
          id: makeId('ntf'),
          userId: recipientId,
          actorId: session.userId,
          type: 'dm',
          title: `New chat message from u/${session.username}`,
          body: content.slice(0, 120),
          link: `/chat?room=${encodeURIComponent(roomId)}`,
        });
      }

      const senderRows = await sql`
        SELECT username, avatar_color FROM or_users WHERE id = ${session.userId} LIMIT 1
      `;

      return res.status(201).json({
        message: {
          id: msgId,
          roomId,
          senderId: session.userId,
          senderUsername: String(senderRows[0]?.username || session.username),
          senderAvatarColor: String(senderRows[0]?.avatar_color || '#FF4500'),
          body: content,
          createdAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'createCustomFeed') {
      const name = String(body.name || '').trim().slice(0, 50);
      const description = String(body.description || '').trim().slice(0, 200);
      const communityIds = Array.isArray(body.communityIds)
        ? body.communityIds.map(String).slice(0, 50)
        : [];
      if (name.length < 2) {
        return res.status(400).json({ error: 'Feed name must be at least 2 characters' });
      }
      const id = makeId('cf');
      await sql`
        INSERT INTO or_custom_feeds (id, user_id, name, description, community_ids)
        VALUES (${id}, ${session.userId}, ${name}, ${description}, ${JSON.stringify(communityIds)}::jsonb)
      `;
      return res.status(201).json({
        customFeed: {
          id,
          name,
          description,
          communityIds,
          createdAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'updateCustomFeed') {
      const id = String(body.id || '');
      const name = String(body.name || '').trim().slice(0, 50);
      const description = String(body.description || '').trim().slice(0, 200);
      const communityIds = Array.isArray(body.communityIds)
        ? body.communityIds.map(String).slice(0, 50)
        : [];
      await sql`
        UPDATE or_custom_feeds
        SET name = ${name}, description = ${description}, community_ids = ${JSON.stringify(communityIds)}::jsonb
        WHERE id = ${id} AND user_id = ${session.userId}
      `;
      return res.status(200).json({ ok: true });
    }

    if (action === 'deleteCustomFeed') {
      const id = String(body.id || '');
      await sql`DELETE FROM or_custom_feeds WHERE id = ${id} AND user_id = ${session.userId}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err: any) {
    console.error('Social API error:', err);
    return res.status(500).json({ error: err?.message || 'Social request failed' });
  }
}
