import type { SqlClient } from './db.js';

export interface HydratedPost {
  id: string;
  communityId: string;
  communityName: string;
  communityTitle: string;
  communityIconEmoji: string;
  communityIconUrl: string | null;
  communityAccentColor: string;
  communityIsUnmoderated: boolean;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarColor: string;
  authorAvatarUrl: string | null;
  authorFlair: string | null;
  title: string;
  postType: string;
  body: string;
  url: string | null;
  media: Array<{ url: string; caption?: string }>;
  pollData: {
    closesAt?: string;
    options: Array<{ id: string; text: string; votes: number }>;
  } | null;
  crosspostOf: string | null;
  crosspost: {
    id: string;
    communityName: string;
    communityIconEmoji: string;
    authorUsername: string;
    title: string;
    postType: string;
    body: string;
    url: string | null;
    media: Array<{ url: string; caption?: string }>;
    score: number;
    commentCount: number;
    createdAt: string;
  } | null;
  flair: { text: string; bg: string; color: string } | null;
  isNsfw: boolean;
  isSpoiler: boolean;
  isOc: boolean;
  isPinned: boolean;
  isLocked: boolean;
  isRemoved: boolean;
  removedReason: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
  awards: Array<{ id: string; count: number }>;
  editedAt: string | null;
  createdAt: string;
  userVote: number;
  isSaved: boolean;
  isHidden: boolean;
  userPollVote: string | null;
}

export async function hydratePosts(
  sql: SqlClient,
  rows: any[],
  viewerId: string | null
): Promise<HydratedPost[]> {
  if (!rows || rows.length === 0) return [];

  const postIds = rows.map((r) => String(r.id));
  const crosspostIds = Array.from(
    new Set(rows.map((r) => r.crosspost_of).filter(Boolean).map(String))
  );

  let userVotes: Record<string, number> = {};
  let savedSet = new Set<string>();
  let hiddenSet = new Set<string>();
  let pollVotes: Record<string, string> = {};

  if (viewerId) {
    const [voteRows, savedRows, hiddenRows, pollRows] = await Promise.all([
      sql.query(
        `SELECT target_id, value FROM or_votes WHERE user_id = $1 AND target_type = 'post' AND target_id = ANY($2)`,
        [viewerId, postIds]
      ),
      sql.query(
        `SELECT target_id FROM or_saved WHERE user_id = $1 AND target_type = 'post' AND target_id = ANY($2)`,
        [viewerId, postIds]
      ),
      sql.query(
        `SELECT post_id FROM or_hidden_posts WHERE user_id = $1 AND post_id = ANY($2)`,
        [viewerId, postIds]
      ),
      sql.query(
        `SELECT post_id, option_id FROM or_poll_votes WHERE user_id = $1 AND post_id = ANY($2)`,
        [viewerId, postIds]
      ),
    ]);
    for (const v of voteRows) userVotes[String(v.target_id)] = Number(v.value);
    for (const s of savedRows) savedSet.add(String(s.target_id));
    for (const h of hiddenRows) hiddenSet.add(String(h.post_id));
    for (const pv of pollRows) pollVotes[String(pv.post_id)] = String(pv.option_id);
  }

  const crosspostMap: Record<string, any> = {};
  if (crosspostIds.length > 0) {
    const cpRows = await sql.query(
      `SELECT p.id, p.title, p.post_type, p.body, p.url, p.media, p.score, p.comment_count, p.created_at,
              c.name AS community_name, c.icon_emoji AS community_icon_emoji,
              u.username AS author_username
       FROM or_posts p
       JOIN or_communities c ON c.id = p.community_id
       JOIN or_users u ON u.id = p.author_id
       WHERE p.id = ANY($1)`,
      [crosspostIds]
    );
    for (const cp of cpRows) {
      crosspostMap[String(cp.id)] = {
        id: String(cp.id),
        communityName: String(cp.community_name),
        communityIconEmoji: String(cp.community_icon_emoji || '🔥'),
        authorUsername: String(cp.author_username),
        title: String(cp.title),
        postType: String(cp.post_type),
        body: String(cp.body || ''),
        url: cp.url ? String(cp.url) : null,
        media: Array.isArray(cp.media) ? cp.media : [],
        score: Number(cp.score || 0),
        commentCount: Number(cp.comment_count || 0),
        createdAt: new Date(cp.created_at).toISOString(),
      };
    }
  }

  return rows.map((r) => ({
    id: String(r.id),
    communityId: String(r.community_id),
    communityName: String(r.community_name),
    communityTitle: String(r.community_title || r.community_name),
    communityIconEmoji: String(r.community_icon_emoji || '🔥'),
    communityIconUrl: r.community_icon_url ? String(r.community_icon_url) : null,
    communityAccentColor: String(r.community_accent_color || '#FF4500'),
    communityIsUnmoderated: Boolean(r.community_is_unmoderated),
    authorId: String(r.author_id),
    authorUsername: String(r.author_username),
    authorDisplayName: String(r.author_display_name || r.author_username),
    authorAvatarColor: String(r.author_avatar_color || '#FF4500'),
    authorAvatarUrl: r.author_avatar_url ? String(r.author_avatar_url) : null,
    authorFlair: r.author_flair ? String(r.author_flair) : null,
    title: String(r.title),
    postType: String(r.post_type || 'text'),
    body: String(r.body || ''),
    url: r.url ? String(r.url) : null,
    media: Array.isArray(r.media) ? r.media : [],
    pollData: r.poll_data || null,
    crosspostOf: r.crosspost_of ? String(r.crosspost_of) : null,
    crosspost: r.crosspost_of ? crosspostMap[String(r.crosspost_of)] || null : null,
    flair: r.flair || null,
    isNsfw: Boolean(r.is_nsfw),
    isSpoiler: Boolean(r.is_spoiler),
    isOc: Boolean(r.is_oc),
    isPinned: Boolean(r.is_pinned),
    isLocked: Boolean(r.is_locked),
    isRemoved: Boolean(r.is_removed),
    removedReason: r.removed_reason ? String(r.removed_reason) : null,
    upvotes: Number(r.upvotes ?? 1),
    downvotes: Number(r.downvotes ?? 0),
    score: Number(r.score ?? 1),
    commentCount: Number(r.comment_count ?? 0),
    awards: Array.isArray(r.awards) ? r.awards : [],
    editedAt: r.edited_at ? new Date(r.edited_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    userVote: userVotes[String(r.id)] || 0,
    isSaved: savedSet.has(String(r.id)),
    isHidden: hiddenSet.has(String(r.id)),
    userPollVote: pollVotes[String(r.id)] || null,
  }));
}

export const BASE_POST_SELECT = `
  SELECT p.*,
         c.name AS community_name,
         c.title AS community_title,
         c.icon_emoji AS community_icon_emoji,
         c.icon_url AS community_icon_url,
         c.accent_color AS community_accent_color,
         c.is_unmoderated AS community_is_unmoderated,
         u.username AS author_username,
         u.display_name AS author_display_name,
         u.avatar_color AS author_avatar_color,
         u.avatar_url AS author_avatar_url,
         cm.user_flair AS author_flair
  FROM or_posts p
  JOIN or_communities c ON c.id = p.community_id
  JOIN or_users u ON u.id = p.author_id
  LEFT JOIN or_community_members cm ON cm.community_id = p.community_id AND cm.user_id = p.author_id
`;
