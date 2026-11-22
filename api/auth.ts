import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearSessionCookie,
  getSessionFromReq,
  hashPassword,
  makeId,
  parseBody,
  setSessionCookie,
  signSession,
  verifyPassword,
} from './_lib/auth.js';
import {
  createNotification,
  DEFAULT_USER_SETTINGS,
  ensureReady,
  sanitizeSettings,
  SqlClient,
} from './_lib/db.js';

function formatUserRow(row: any) {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name || row.username),
    bio: String(row.bio || ''),
    avatarColor: String(row.avatar_color || '#FF4500'),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    bannerColor: String(row.banner_color || '#1A282D'),
    postKarma: Number(row.post_karma ?? 1),
    commentKarma: Number(row.comment_karma ?? 0),
    trophies: Array.isArray(row.trophies) ? row.trophies : [],
    settings: sanitizeSettings(row.settings),
    isAdmin: Boolean(row.is_admin),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function loadUserExtras(sql: SqlClient, userId: string) {
  const [joinedRows, customFeedRows, unreadRows] = await Promise.all([
    sql`
      SELECT cm.community_id, cm.role, cm.user_flair, cm.is_favorite,
             c.name, c.icon_emoji, c.accent_color, c.member_count
      FROM or_community_members cm
      JOIN or_communities c ON c.id = cm.community_id
      WHERE cm.user_id = ${userId} AND cm.is_banned = FALSE
      ORDER BY cm.is_favorite DESC, c.name ASC
    `,
    sql`
      SELECT id, name, description, community_ids, created_at
      FROM or_custom_feeds
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT COUNT(*)::int AS cnt
      FROM or_notifications
      WHERE user_id = ${userId} AND is_read = FALSE
    `,
  ]);

  return {
    joinedCommunities: joinedRows.map((r: any) => ({
      communityId: String(r.community_id),
      name: String(r.name),
      iconEmoji: String(r.icon_emoji || '🔥'),
      accentColor: String(r.accent_color || '#FF4500'),
      memberCount: Number(r.member_count || 0),
      role: String(r.role || 'member'),
      userFlair: r.user_flair ? String(r.user_flair) : null,
      isFavorite: Boolean(r.is_favorite),
    })),
    customFeeds: customFeedRows.map((f: any) => ({
      id: String(f.id),
      name: String(f.name),
      description: String(f.description || ''),
      communityIds: Array.isArray(f.community_ids) ? f.community_ids : [],
      createdAt: new Date(f.created_at).toISOString(),
    })),
    unreadNotifications: Number(unreadRows[0]?.cnt ?? 0),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = await ensureReady();

    if (req.method === 'GET') {
      const session = getSessionFromReq(req);
      if (!session) {
        return res.status(200).json({
          user: null,
          joinedCommunities: [],
          customFeeds: [],
          unreadNotifications: 0,
        });
      }
      const rows = await sql`
        SELECT * FROM or_users WHERE id = ${session.userId} LIMIT 1
      `;
      if (rows.length === 0) {
        return res.status(200).json({
          user: null,
          joinedCommunities: [],
          customFeeds: [],
          unreadNotifications: 0,
        });
      }
      const extras = await loadUserExtras(sql, session.userId);
      return res.status(200).json({
        user: formatUserRow(rows[0]),
        ...extras,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = parseBody(req);
    const action = String(body.action || '');

    if (action === 'logout') {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (action === 'register') {
      const rawUsername = String(body.username || '').trim();
      const password = String(body.password || '');
      const displayName = String(body.displayName || rawUsername).trim().slice(0, 40);
      const bio = String(body.bio || 'Speaking freely on OpenRed.').trim().slice(0, 300);
      const avatarColor = /^#[0-9a-fA-F]{6}$/.test(String(body.avatarColor || ''))
        ? String(body.avatarColor)
        : '#FF4500';
      const avatarUrl =
        typeof body.avatarUrl === 'string' && body.avatarUrl.length > 0
          ? body.avatarUrl.slice(0, 500000)
          : null;

      if (!/^[a-zA-Z0-9_]{3,24}$/.test(rawUsername)) {
        return res.status(400).json({
          error: 'Username must be 3–24 characters using letters, numbers, or underscores.',
        });
      }
      if (password.length < 6) {
        return res
          .status(400)
          .json({ error: 'Password must be at least 6 characters.' });
      }

      const existing = await sql`
        SELECT id FROM or_users WHERE LOWER(username) = LOWER(${rawUsername}) LIMIT 1
      `;
      if (existing.length > 0) {
        return res.status(409).json({
          error: `u/${rawUsername} is already taken. Pick another username or sign in.`,
        });
      }

      const userId = makeId('usr');
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const trophies = ['Pioneer'];

      const inserted = await sql`
        INSERT INTO or_users (
          id, username, display_name, password_hash, salt, bio,
          avatar_color, avatar_url, trophies, settings
        )
        VALUES (
          ${userId}, ${rawUsername}, ${displayName || rawUsername}, ${passwordHash},
          ${salt}, ${bio}, ${avatarColor}, ${avatarUrl},
          ${JSON.stringify(trophies)}::jsonb,
          ${JSON.stringify(DEFAULT_USER_SETTINGS)}::jsonb
        )
        RETURNING *
      `;

      await createNotification(sql, {
        id: makeId('ntf'),
        userId,
        actorId: null,
        type: 'welcome',
        title: 'Welcome to OpenRed!',
        body: 'No email required, zero shadowbans, and every moderation action is public at /modlog. Create a community or start posting!',
        link: '/explore',
      });

      const token = signSession(userId, rawUsername);
      setSessionCookie(res, token);
      const extras = await loadUserExtras(sql, userId);

      return res.status(201).json({
        user: formatUserRow(inserted[0]),
        token,
        ...extras,
      });
    }

    if (action === 'login') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }
      const rows = await sql`
        SELECT * FROM or_users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
      `;
      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
      const userRow = rows[0];
      if (!verifyPassword(password, String(userRow.salt), String(userRow.password_hash))) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
      const token = signSession(String(userRow.id), String(userRow.username));
      setSessionCookie(res, token);
      const extras = await loadUserExtras(sql, String(userRow.id));

      return res.status(200).json({
        user: formatUserRow(userRow),
        token,
        ...extras,
      });
    }

    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (action === 'updateProfile') {
      const displayName = String(body.displayName || '').trim().slice(0, 40);
      const bio = String(body.bio ?? '').trim().slice(0, 400);
      const avatarColor = /^#[0-9a-fA-F]{6}$/.test(String(body.avatarColor || ''))
        ? String(body.avatarColor)
        : '#FF4500';
      const bannerColor = /^#[0-9a-fA-F]{6}$/.test(String(body.bannerColor || ''))
        ? String(body.bannerColor)
        : '#1A282D';
      const avatarUrl =
        typeof body.avatarUrl === 'string' && body.avatarUrl.length > 0
          ? body.avatarUrl.slice(0, 600000)
          : body.avatarUrl === null
            ? null
            : undefined;

      const updated =
        avatarUrl === undefined
          ? await sql`
              UPDATE or_users
              SET display_name = COALESCE(NULLIF(${displayName}, ''), display_name),
                  bio = ${bio},
                  avatar_color = ${avatarColor},
                  banner_color = ${bannerColor}
              WHERE id = ${session.userId}
              RETURNING *
            `
          : await sql`
              UPDATE or_users
              SET display_name = COALESCE(NULLIF(${displayName}, ''), display_name),
                  bio = ${bio},
                  avatar_color = ${avatarColor},
                  banner_color = ${bannerColor},
                  avatar_url = ${avatarUrl}
              WHERE id = ${session.userId}
              RETURNING *
            `;
      if (updated.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ user: formatUserRow(updated[0]) });
    }

    if (action === 'updateSettings') {
      const clean = sanitizeSettings(body.settings);
      const updated = await sql`
        UPDATE or_users
        SET settings = ${JSON.stringify(clean)}::jsonb
        WHERE id = ${session.userId}
        RETURNING *
      `;
      if (updated.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ user: formatUserRow(updated[0]) });
    }

    if (action === 'exportData') {
      const [userRows, posts, comments, saved, votes, feeds] = await Promise.all([
        sql`SELECT id, username, display_name, bio, post_karma, comment_karma, trophies, settings, created_at FROM or_users WHERE id = ${session.userId}`,
        sql`SELECT * FROM or_posts WHERE author_id = ${session.userId} ORDER BY created_at DESC`,
        sql`SELECT * FROM or_comments WHERE author_id = ${session.userId} ORDER BY created_at DESC`,
        sql`SELECT * FROM or_saved WHERE user_id = ${session.userId}`,
        sql`SELECT * FROM or_votes WHERE user_id = ${session.userId}`,
        sql`SELECT * FROM or_custom_feeds WHERE user_id = ${session.userId}`,
      ]);
      return res.status(200).json({
        exportedAt: new Date().toISOString(),
        user: userRows[0] || null,
        posts,
        comments,
        saved,
        votes,
        customFeeds: feeds,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err: any) {
    console.error('Auth API error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
