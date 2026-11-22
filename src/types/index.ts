export type PostSort = 'hot' | 'best' | 'new' | 'top' | 'rising' | 'controversial';
export type CommentSort = 'best' | 'top' | 'new' | 'controversial' | 'old' | 'qa';
export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
export type ViewMode = 'card' | 'compact' | 'classic';
export type ThemeMode = 'dark' | 'light';

export interface UserSettings {
  theme: ThemeMode;
  viewMode: ViewMode;
  showNsfw: boolean;
  blurNsfw: boolean;
  blurSpoilers: boolean;
  mutedKeywords: string[];
  mutedCommunities: string[];
  blockedUsers: string[];
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  avatarUrl: string | null;
  bannerColor: string;
  postKarma: number;
  commentKarma: number;
  trophies: string[];
  settings: UserSettings;
  isAdmin: boolean;
  createdAt: string;
}

export interface JoinedCommunitySummary {
  communityId: string;
  name: string;
  iconEmoji: string;
  accentColor: string;
  memberCount: number;
  role: string;
  userFlair: string | null;
  isFavorite: boolean;
}

export interface CustomFeed {
  id: string;
  name: string;
  description: string;
  communityIds: string[];
  createdAt: string;
}

export interface PostFlair {
  text: string;
  bg: string;
  color: string;
}

export interface CommunityRule {
  title: string;
  description: string;
}

export interface Community {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  iconEmoji: string;
  iconUrl?: string | null;
  accentColor: string;
  bannerColor: string;
  bannerUrl?: string | null;
  isNsfw: boolean;
  isUnmoderated: boolean;
  rules: CommunityRule[];
  postFlairs: PostFlair[];
  userFlairs: string[];
  creatorId?: string | null;
  memberCount: number;
  createdAt: string;
  isJoined?: boolean;
  isFavorite?: boolean;
  role?: string | null;
  userFlair?: string | null;
  isBanned?: boolean;
}

export interface CommunityModerator {
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  role: string;
  userFlair: string | null;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PostMediaItem {
  url: string;
  caption?: string;
}

export interface AwardBadge {
  id: string;
  count: number;
}

export interface CrosspostSummary {
  id: string;
  communityName: string;
  communityIconEmoji: string;
  authorUsername: string;
  title: string;
  postType: string;
  body: string;
  url: string | null;
  media: PostMediaItem[];
  score: number;
  commentCount: number;
  createdAt: string;
}

export interface Post {
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
  postType: 'text' | 'image' | 'gallery' | 'link' | 'video' | 'poll' | 'crosspost' | string;
  body: string;
  url: string | null;
  media: PostMediaItem[];
  pollData: { closesAt?: string; options: PollOption[] } | null;
  crosspostOf: string | null;
  crosspost: CrosspostSummary | null;
  flair: PostFlair | null;
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
  awards: AwardBadge[];
  editedAt: string | null;
  createdAt: string;
  userVote: number;
  isSaved: boolean;
  isHidden: boolean;
  userPollVote: string | null;
}

export interface CommentItem {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarColor: string;
  authorAvatarUrl: string | null;
  authorFlair: string | null;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  isPinned: boolean;
  isModDistinguished: boolean;
  isDeleted: boolean;
  awards: AwardBadge[];
  editedAt: string | null;
  createdAt: string;
  userVote: number;
  isSaved: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  actorUsername: string | null;
  actorAvatarColor: string;
  createdAt: string;
}

export interface ChatRoom {
  roomId: string;
  label: string;
  subtitle: string;
  peerId?: string;
  peerUsername?: string;
  avatarColor?: string;
  isGlobal: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  senderAvatarColor: string;
  body: string;
  createdAt: string;
}

export interface ModLogEntry {
  id: string;
  communityId: string;
  communityName: string;
  communityIconEmoji: string;
  moderatorId: string;
  moderatorUsername: string;
  moderatorAvatarColor: string;
  action: string;
  targetId: string | null;
  targetSummary: string;
  reason: string;
  createdAt: string;
}

export interface PostDraft {
  id: string;
  communityName: string;
  postType: string;
  title: string;
  body: string;
  url: string;
  savedAt: string;
}
