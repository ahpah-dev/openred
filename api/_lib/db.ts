import { neon, NeonQueryFunction } from '@neondatabase/serverless';

export type SqlClient = NeonQueryFunction<false, false>;

export function getSql(): SqlClient {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('DATABASE_URL or POSTGRES_URL environment variable is required');
  }
  return neon(url);
}

let readyPromise: Promise<void> | null = null;

async function cleanupFakeSeedData(sql: SqlClient): Promise<void> {
  const fakeUserIds = [
    'usr_founder',
    'usr_kernel',
    'usr_aria',
    'usr_cipher',
    'usr_retro',
    'usr_quantum',
    'usr_pixel',
    'usr_skeptic',
  ];
  const fakeCommunityIds = [
    'com_openred',
    'com_freespeech',
    'com_technology',
    'com_programming',
    'com_askopenred',
    'com_worldnews',
    'com_privacy',
    'com_gaming',
    'com_science',
    'com_unpopularopinion',
    'com_memes',
    'com_localllama',
  ];
  const fakePostIds = [
    'post_charter',
    'post_localllama_bench',
    'post_poll_speech',
    'post_gallery_builds',
    'post_privacy_stack',
    'post_ask_secret',
    'post_prog_postgres',
    'post_unpopular_ads',
    'post_gaming_spoiler',
    'post_nsfw_spicy',
    'post_science_fusion',
    'post_worldnews_grid',
    'post_memes_rice',
    'post_crosspost_bench',
    'post_poll_theme',
  ];
  const fakeModLogIds = ['mod_1', 'mod_2', 'mod_3', 'mod_4'];
  const fakeMsgIds = ['msg_lobby_1', 'msg_lobby_2', 'msg_lobby_3'];

  // Include any automated verify_bot test users
  const botRows = await sql`SELECT id FROM or_users WHERE username LIKE 'verify_bot_%'`;
  const allFakeUsers = [...fakeUserIds, ...botRows.map((r: any) => String(r.id))];

  await sql.query(`DELETE FROM or_comments WHERE post_id = ANY($1) OR author_id = ANY($2)`, [
    fakePostIds,
    allFakeUsers,
  ]);
  await sql.query(`DELETE FROM or_votes WHERE target_id = ANY($1) OR user_id = ANY($2)`, [
    fakePostIds,
    allFakeUsers,
  ]);
  await sql.query(`DELETE FROM or_poll_votes WHERE post_id = ANY($1) OR user_id = ANY($2)`, [
    fakePostIds,
    allFakeUsers,
  ]);
  await sql.query(`DELETE FROM or_saved WHERE target_id = ANY($1) OR user_id = ANY($2)`, [
    fakePostIds,
    allFakeUsers,
  ]);
  await sql.query(`DELETE FROM or_hidden_posts WHERE post_id = ANY($1) OR user_id = ANY($2)`, [
    fakePostIds,
    allFakeUsers,
  ]);
  await sql.query(`DELETE FROM or_posts WHERE id = ANY($1) OR community_id = ANY($2)`, [
    fakePostIds,
    fakeCommunityIds,
  ]);
  await sql.query(
    `DELETE FROM or_mod_logs WHERE id = ANY($1) OR community_id = ANY($2) OR moderator_id = ANY($3)`,
    [fakeModLogIds, fakeCommunityIds, allFakeUsers]
  );
  await sql.query(`DELETE FROM or_messages WHERE id = ANY($1) OR sender_id = ANY($2)`, [
    fakeMsgIds,
    allFakeUsers,
  ]);
  await sql.query(
    `DELETE FROM or_community_members WHERE community_id = ANY($1) OR user_id = ANY($2)`,
    [fakeCommunityIds, allFakeUsers]
  );
  await sql.query(`DELETE FROM or_communities WHERE id = ANY($1)`, [fakeCommunityIds]);
  await sql.query(
    `DELETE FROM or_notifications WHERE user_id = ANY($1) OR actor_id = ANY($1)`,
    [allFakeUsers]
  );
  await sql.query(
    `DELETE FROM or_follows WHERE follower_id = ANY($1) OR following_id = ANY($1)`,
    [allFakeUsers]
  );
  await sql.query(`DELETE FROM or_custom_feeds WHERE user_id = ANY($1)`, [allFakeUsers]);
  await sql.query(`DELETE FROM or_users WHERE id = ANY($1)`, [allFakeUsers]);
}

async function initSchema(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS or_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      avatar_color TEXT NOT NULL DEFAULT '#FF4500',
      avatar_url TEXT,
      banner_color TEXT NOT NULL DEFAULT '#181C1F',
      post_karma INTEGER NOT NULL DEFAULT 1,
      comment_karma INTEGER NOT NULL DEFAULT 0,
      trophies JSONB NOT NULL DEFAULT '[]'::jsonb,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_communities (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      icon_emoji TEXT NOT NULL DEFAULT '🔥',
      icon_url TEXT,
      accent_color TEXT NOT NULL DEFAULT '#FF4500',
      banner_color TEXT NOT NULL DEFAULT '#181C1F',
      banner_url TEXT,
      is_nsfw BOOLEAN NOT NULL DEFAULT FALSE,
      is_unmoderated BOOLEAN NOT NULL DEFAULT FALSE,
      rules JSONB NOT NULL DEFAULT '[]'::jsonb,
      post_flairs JSONB NOT NULL DEFAULT '[]'::jsonb,
      user_flairs JSONB NOT NULL DEFAULT '[]'::jsonb,
      sidebar_links JSONB NOT NULL DEFAULT '[]'::jsonb,
      creator_id TEXT,
      member_count INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_community_members (
      community_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      user_flair TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (community_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_posts (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      post_type TEXT NOT NULL DEFAULT 'text',
      body TEXT NOT NULL DEFAULT '',
      url TEXT,
      media JSONB NOT NULL DEFAULT '[]'::jsonb,
      poll_data JSONB,
      crosspost_of TEXT,
      flair JSONB,
      is_nsfw BOOLEAN NOT NULL DEFAULT FALSE,
      is_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
      is_oc BOOLEAN NOT NULL DEFAULT FALSE,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      is_locked BOOLEAN NOT NULL DEFAULT FALSE,
      is_removed BOOLEAN NOT NULL DEFAULT FALSE,
      removed_reason TEXT,
      upvotes INTEGER NOT NULL DEFAULT 1,
      downvotes INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 1,
      comment_count INTEGER NOT NULL DEFAULT 0,
      awards JSONB NOT NULL DEFAULT '[]'::jsonb,
      edited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      parent_id TEXT,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      upvotes INTEGER NOT NULL DEFAULT 1,
      downvotes INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 1,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      is_mod_distinguished BOOLEAN NOT NULL DEFAULT FALSE,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      awards JSONB NOT NULL DEFAULT '[]'::jsonb,
      edited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_votes (
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      value INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, target_type, target_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_poll_votes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_saved (
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, target_type, target_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_hidden_posts (
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, post_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_follows (
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_custom_feeds (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      community_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      actor_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '/',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      recipient_id TEXT,
      body TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS or_mod_logs (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT,
      target_summary TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_or_posts_community_created ON or_posts (community_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_or_posts_author ON or_posts (author_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_or_comments_post_created ON or_comments (post_id, created_at ASC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_or_messages_room_created ON or_messages (room_id, created_at ASC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_or_notifications_user ON or_notifications (user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_or_mod_logs_created ON or_mod_logs (created_at DESC)`;

  // One-time cleanup of initial demo/seeded records so the live instance is 100% genuine user content
  const cleaned = await sql`
    INSERT INTO or_meta (key, value)
    VALUES ('cleanup_fake_seed_v1', 'done')
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `;
  if (cleaned.length > 0) {
    await cleanupFakeSeedData(sql);
  }
}

export async function ensureReady(): Promise<SqlClient> {
  const sql = getSql();
  if (!readyPromise) {
    readyPromise = initSchema(sql).catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  await readyPromise;
  return sql;
}

export const DEFAULT_USER_SETTINGS = {
  theme: 'dark',
  viewMode: 'card',
  showNsfw: true,
  blurNsfw: true,
  blurSpoilers: true,
  mutedKeywords: [] as string[],
  mutedCommunities: [] as string[],
  blockedUsers: [] as string[],
};

export function sanitizeSettings(raw: any) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    theme: s.theme === 'light' ? 'light' : 'dark',
    viewMode:
      s.viewMode === 'compact' || s.viewMode === 'classic' ? s.viewMode : 'card',
    showNsfw: typeof s.showNsfw === 'boolean' ? s.showNsfw : true,
    blurNsfw: typeof s.blurNsfw === 'boolean' ? s.blurNsfw : true,
    blurSpoilers: typeof s.blurSpoilers === 'boolean' ? s.blurSpoilers : true,
    mutedKeywords: Array.isArray(s.mutedKeywords)
      ? s.mutedKeywords.map(String).slice(0, 100)
      : [],
    mutedCommunities: Array.isArray(s.mutedCommunities)
      ? s.mutedCommunities.map(String).slice(0, 100)
      : [],
    blockedUsers: Array.isArray(s.blockedUsers)
      ? s.blockedUsers.map(String).slice(0, 100)
      : [],
  };
}

export async function addModLog(
  sql: SqlClient,
  params: {
    id: string;
    communityId: string;
    moderatorId: string;
    action: string;
    targetId?: string | null;
    targetSummary: string;
    reason: string;
  }
): Promise<void> {
  await sql`
    INSERT INTO or_mod_logs (id, community_id, moderator_id, action, target_id, target_summary, reason)
    VALUES (
      ${params.id},
      ${params.communityId},
      ${params.moderatorId},
      ${params.action},
      ${params.targetId ?? null},
      ${params.targetSummary},
      ${params.reason}
    )
  `;
}

export async function createNotification(
  sql: SqlClient,
  params: {
    id: string;
    userId: string;
    actorId: string | null;
    type: string;
    title: string;
    body: string;
    link: string;
  }
): Promise<void> {
  if (!params.userId || params.userId === params.actorId) return;
  await sql`
    INSERT INTO or_notifications (id, user_id, actor_id, type, title, body, link)
    VALUES (
      ${params.id},
      ${params.userId},
      ${params.actorId},
      ${params.type},
      ${params.title},
      ${params.body},
      ${params.link}
    )
  `;
}

export async function getUserNotificationsAndMentions(
  sql: SqlClient,
  body: string
): Promise<string[]> {
  const matches = body.match(/(?:^|\s)u\/([a-zA-Z0-9_-]{3,24})/g) || [];
  const usernames = Array.from(
    new Set(matches.map((m) => m.trim().replace(/^u\//i, '').toLowerCase()))
  ).slice(0, 5);
  if (usernames.length === 0) return [];
  const rows = await sql.query(
    `SELECT id FROM or_users WHERE LOWER(username) = ANY($1)`,
    [usernames]
  );
  return rows.map((r: any) => String(r.id));
}
