import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq, makeId, parseBody } from './_lib/auth.js';
import { addModLog, ensureReady } from './_lib/db.js';

function formatCommunity(c: any, mem?: any) {
  return {
    id: String(c.id),
    name: String(c.name),
    title: String(c.title || c.name),
    description: String(c.description || ''),
    category: String(c.category || 'General'),
    iconEmoji: String(c.icon_emoji || '🔥'),
    iconUrl: c.icon_url ? String(c.icon_url) : null,
    accentColor: String(c.accent_color || '#FF4500'),
    bannerColor: String(c.banner_color || '#1A282D'),
    bannerUrl: c.banner_url ? String(c.banner_url) : null,
    isNsfw: Boolean(c.is_nsfw),
    isUnmoderated: Boolean(c.is_unmoderated),
    rules: Array.isArray(c.rules) ? c.rules : [],
    postFlairs: Array.isArray(c.post_flairs) ? c.post_flairs : [],
    userFlairs: Array.isArray(c.user_flairs) ? c.user_flairs : [],
    sidebarLinks: Array.isArray(c.sidebar_links) ? c.sidebar_links : [],
    creatorId: c.creator_id ? String(c.creator_id) : null,
    memberCount: Number(c.member_count || 0),
    createdAt: new Date(c.created_at).toISOString(),
    isJoined: Boolean(mem && !mem.is_banned),
    isFavorite: Boolean(mem?.is_favorite),
    role: mem ? String(mem.role) : null,
    userFlair: mem?.user_flair ? String(mem.user_flair) : null,
    isBanned: Boolean(mem?.is_banned),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = await ensureReady();
    const session = getSessionFromReq(req);
    const viewerId = session?.userId || null;

    if (req.method === 'GET') {
      const name = String(req.query.name || '').trim();
      if (name) {
        const rows = await sql`
          SELECT * FROM or_communities WHERE LOWER(name) = LOWER(${name}) LIMIT 1
        `;
        if (rows.length === 0) {
          return res.status(404).json({ error: `r/${name} not found` });
        }
        const comm = rows[0];
        const [modRows, memRows] = await Promise.all([
          sql`
            SELECT cm.user_id, cm.role, cm.user_flair, u.username, u.display_name, u.avatar_color
            FROM or_community_members cm
            JOIN or_users u ON u.id = cm.user_id
            WHERE cm.community_id = ${String(comm.id)} AND cm.role IN ('owner', 'mod')
            ORDER BY CASE WHEN cm.role = 'owner' THEN 0 ELSE 1 END, u.username ASC
          `,
          viewerId
            ? sql`
                SELECT * FROM or_community_members
                WHERE community_id = ${String(comm.id)} AND user_id = ${viewerId} LIMIT 1
              `
            : Promise.resolve([]),
        ]);

        return res.status(200).json({
          community: formatCommunity(comm, memRows[0]),
          moderators: modRows.map((m: any) => ({
            userId: String(m.user_id),
            username: String(m.username),
            displayName: String(m.display_name || m.username),
            avatarColor: String(m.avatar_color || '#FF4500'),
            role: String(m.role),
            userFlair: m.user_flair ? String(m.user_flair) : null,
          })),
        });
      }

      const category = String(req.query.category || '').trim();
      const q = String(req.query.q || '').trim();

      const allRows = await sql`
        SELECT * FROM or_communities ORDER BY member_count DESC, name ASC
      `;
      let memMap: Record<string, any> = {};
      if (viewerId) {
        const memRows = await sql`
          SELECT * FROM or_community_members WHERE user_id = ${viewerId}
        `;
        for (const m of memRows) memMap[String(m.community_id)] = m;
      }

      let formatted = allRows.map((c: any) => formatCommunity(c, memMap[String(c.id)]));
      if (category && category !== 'All') {
        formatted = formatted.filter(
          (c) => c.category.toLowerCase() === category.toLowerCase()
        );
      }
      if (q) {
        const lower = q.toLowerCase();
        formatted = formatted.filter(
          (c) =>
            c.name.toLowerCase().includes(lower) ||
            c.title.toLowerCase().includes(lower) ||
            c.description.toLowerCase().includes(lower)
        );
      }

      return res.status(200).json({ communities: formatted });
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
      const name = String(body.name || '').trim();
      const title = String(body.title || name).trim().slice(0, 100);
      const description = String(body.description || '').trim().slice(0, 600);
      const category = String(body.category || 'General').trim();
      const iconEmoji = String(body.iconEmoji || '🔥').slice(0, 8);
      const accentColor = /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || ''))
        ? String(body.accentColor)
        : '#FF4500';
      const bannerColor = /^#[0-9a-fA-F]{6}$/.test(String(body.bannerColor || ''))
        ? String(body.bannerColor)
        : '#1A282D';
      const isNsfw = Boolean(body.isNsfw);
      const isUnmoderated = Boolean(body.isUnmoderated);

      if (!/^[a-zA-Z0-9_]{3,21}$/.test(name)) {
        return res.status(400).json({
          error: 'Community name must be 3–21 characters using letters, numbers, or underscores.',
        });
      }

      const existing = await sql`
        SELECT id FROM or_communities WHERE LOWER(name) = LOWER(${name}) LIMIT 1
      `;
      if (existing.length > 0) {
        return res.status(409).json({ error: `r/${name} already exists.` });
      }

      const commId = makeId('com');
      const defaultRules = isUnmoderated
        ? [
            {
              title: 'Zero-Moderation Free-Speech Zone',
              description:
                'Moderators cannot remove posts or ban users in this community.',
            },
          ]
        : [
            {
              title: 'Open discussion',
              description: 'Speak freely and engage in good faith. Every mod action is logged publicly.',
            },
          ];
      const defaultPostFlairs = [
        { text: 'Discussion', bg: accentColor, color: '#FFFFFF' },
        { text: 'News', bg: '#2563EB', color: '#FFFFFF' },
        { text: 'OC', bg: '#16A34A', color: '#FFFFFF' },
      ];
      const defaultUserFlairs = ['Founder', 'Regular', 'Contributor'];

      const inserted = await sql`
        INSERT INTO or_communities (
          id, name, title, description, category, icon_emoji, accent_color, banner_color,
          is_nsfw, is_unmoderated, rules, post_flairs, user_flairs, creator_id, member_count
        )
        VALUES (
          ${commId}, ${name}, ${title || name}, ${description}, ${category}, ${iconEmoji},
          ${accentColor}, ${bannerColor}, ${isNsfw}, ${isUnmoderated},
          ${JSON.stringify(defaultRules)}::jsonb,
          ${JSON.stringify(defaultPostFlairs)}::jsonb,
          ${JSON.stringify(defaultUserFlairs)}::jsonb,
          ${session.userId}, 1
        )
        RETURNING *
      `;

      await sql`
        INSERT INTO or_community_members (community_id, user_id, role, user_flair, is_favorite)
        VALUES (${commId}, ${session.userId}, 'owner', 'Founder', TRUE)
      `;

      await addModLog(sql, {
        id: makeId('mod'),
        communityId: commId,
        moderatorId: session.userId,
        action: isUnmoderated ? 'CREATE_UNMODERATED_COMMUNITY' : 'CREATE_COMMUNITY',
        targetId: commId,
        targetSummary: `r/${name}`,
        reason: isUnmoderated
          ? 'Created as a Zero-Moderation Free-Speech Zone.'
          : 'Created new community on OpenRed.',
      });

      return res.status(201).json({
        community: formatCommunity(inserted[0], {
          role: 'owner',
          is_favorite: true,
          user_flair: 'Founder',
          is_banned: false,
        }),
      });
    }

    const communityId = String(body.communityId || '').trim();
    if (!communityId) {
      return res.status(400).json({ error: 'Missing communityId' });
    }

    if (action === 'join' || action === 'leave') {
      const existing = await sql`
        SELECT role, is_banned FROM or_community_members
        WHERE community_id = ${communityId} AND user_id = ${session.userId} LIMIT 1
      `;
      if (existing[0]?.is_banned) {
        return res.status(403).json({ error: 'You are banned from this community' });
      }
      if (action === 'join' && existing.length === 0) {
        await sql`
          INSERT INTO or_community_members (community_id, user_id, role)
          VALUES (${communityId}, ${session.userId}, 'member')
        `;
        await sql`
          UPDATE or_communities SET member_count = member_count + 1 WHERE id = ${communityId}
        `;
      } else if (action === 'leave' && existing.length > 0) {
        await sql`
          DELETE FROM or_community_members
          WHERE community_id = ${communityId} AND user_id = ${session.userId}
        `;
        await sql`
          UPDATE or_communities SET member_count = GREATEST(0, member_count - 1) WHERE id = ${communityId}
        `;
      }
      const cRows = await sql`SELECT member_count FROM or_communities WHERE id = ${communityId} LIMIT 1`;
      return res.status(200).json({
        isJoined: action === 'join',
        memberCount: Number(cRows[0]?.member_count ?? 0),
      });
    }

    if (action === 'favorite') {
      const mem = await sql`
        SELECT is_favorite FROM or_community_members
        WHERE community_id = ${communityId} AND user_id = ${session.userId} LIMIT 1
      `;
      if (mem.length === 0) {
        await sql`
          INSERT INTO or_community_members (community_id, user_id, role, is_favorite)
          VALUES (${communityId}, ${session.userId}, 'member', TRUE)
        `;
        await sql`UPDATE or_communities SET member_count = member_count + 1 WHERE id = ${communityId}`;
        return res.status(200).json({ isFavorite: true, isJoined: true });
      }
      const nextFav = !Boolean(mem[0].is_favorite);
      await sql`
        UPDATE or_community_members SET is_favorite = ${nextFav}
        WHERE community_id = ${communityId} AND user_id = ${session.userId}
      `;
      return res.status(200).json({ isFavorite: nextFav, isJoined: true });
    }

    if (action === 'setUserFlair') {
      const flair = body.userFlair ? String(body.userFlair).trim().slice(0, 32) : null;
      const mem = await sql`
        SELECT 1 FROM or_community_members
        WHERE community_id = ${communityId} AND user_id = ${session.userId} LIMIT 1
      `;
      if (mem.length === 0) {
        await sql`
          INSERT INTO or_community_members (community_id, user_id, role, user_flair)
          VALUES (${communityId}, ${session.userId}, 'member', ${flair})
        `;
        await sql`UPDATE or_communities SET member_count = member_count + 1 WHERE id = ${communityId}`;
      } else {
        await sql`
          UPDATE or_community_members SET user_flair = ${flair}
          WHERE community_id = ${communityId} AND user_id = ${session.userId}
        `;
      }
      return res.status(200).json({ userFlair: flair });
    }

    // Owner/mod checks for community management
    const [memCheck, userCheck, commRows] = await Promise.all([
      sql`
        SELECT role FROM or_community_members
        WHERE community_id = ${communityId} AND user_id = ${session.userId} LIMIT 1
      `,
      sql`SELECT is_admin FROM or_users WHERE id = ${session.userId} LIMIT 1`,
      sql`SELECT * FROM or_communities WHERE id = ${communityId} LIMIT 1`,
    ]);
    if (commRows.length === 0) return res.status(404).json({ error: 'Community not found' });
    const role = memCheck[0]?.role;
    const isAdmin = Boolean(userCheck[0]?.is_admin);
    const isModOrOwner = role === 'owner' || role === 'mod' || isAdmin;
    if (!isModOrOwner) {
      return res.status(403).json({ error: 'Moderator permission required' });
    }

    if (action === 'update') {
      const comm = commRows[0];
      const title = String(body.title ?? comm.title).trim().slice(0, 100);
      const description = String(body.description ?? comm.description).trim().slice(0, 800);
      const iconEmoji = String(body.iconEmoji ?? comm.icon_emoji).slice(0, 8);
      const accentColor = /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || ''))
        ? String(body.accentColor)
        : String(comm.accent_color);
      const bannerColor = /^#[0-9a-fA-F]{6}$/.test(String(body.bannerColor || ''))
        ? String(body.bannerColor)
        : String(comm.banner_color);
      const isNsfw = typeof body.isNsfw === 'boolean' ? body.isNsfw : Boolean(comm.is_nsfw);
      const rules = Array.isArray(body.rules) ? body.rules.slice(0, 15) : comm.rules;
      const postFlairs = Array.isArray(body.postFlairs)
        ? body.postFlairs.slice(0, 20)
        : comm.post_flairs;
      const userFlairs = Array.isArray(body.userFlairs)
        ? body.userFlairs.slice(0, 25)
        : comm.user_flairs;

      const updated = await sql`
        UPDATE or_communities
        SET title = ${title},
            description = ${description},
            icon_emoji = ${iconEmoji},
            accent_color = ${accentColor},
            banner_color = ${bannerColor},
            is_nsfw = ${isNsfw},
            rules = ${JSON.stringify(rules)}::jsonb,
            post_flairs = ${JSON.stringify(postFlairs)}::jsonb,
            user_flairs = ${JSON.stringify(userFlairs)}::jsonb
        WHERE id = ${communityId}
        RETURNING *
      `;

      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: 'UPDATE_COMMUNITY_SETTINGS',
        targetId: communityId,
        targetSummary: `r/${String(comm.name)}`,
        reason: String(body.reason || 'Updated community info, rules, or flairs.'),
      });

      return res.status(200).json({ community: formatCommunity(updated[0], memCheck[0]) });
    }

    if (action === 'addMod' || action === 'removeMod') {
      if (role !== 'owner' && !isAdmin) {
        return res.status(403).json({ error: 'Only community owner can manage moderators' });
      }
      const targetUsername = String(body.username || '').trim();
      const targetUsers = await sql`
        SELECT id, username FROM or_users WHERE LOWER(username) = LOWER(${targetUsername}) LIMIT 1
      `;
      if (targetUsers.length === 0) {
        return res.status(404).json({ error: `u/${targetUsername} not found` });
      }
      const targetId = String(targetUsers[0].id);
      const newRole = action === 'addMod' ? 'mod' : 'member';

      await sql`
        INSERT INTO or_community_members (community_id, user_id, role)
        VALUES (${communityId}, ${targetId}, ${newRole})
        ON CONFLICT (community_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `;

      await addModLog(sql, {
        id: makeId('mod'),
        communityId,
        moderatorId: session.userId,
        action: action === 'addMod' ? 'ADD_MODERATOR' : 'REMOVE_MODERATOR',
        targetId,
        targetSummary: `u/${String(targetUsers[0].username)}`,
        reason: String(body.reason || (action === 'addMod' ? 'Appointed moderator' : 'Removed moderator')),
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err: any) {
    console.error('Communities API error:', err);
    return res.status(500).json({ error: err?.message || 'Community request failed' });
  }
}
