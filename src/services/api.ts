import type {
  ChatMessage,
  ChatRoom,
  CommentItem,
  CommentSort,
  Community,
  CommunityModerator,
  CustomFeed,
  JoinedCommunitySummary,
  ModLogEntry,
  NotificationItem,
  Post,
  PostSort,
  TimeRange,
  User,
  UserSettings,
} from '../types';

const TOKEN_KEY = 'openred_token_v1';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage limits
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function compressImageToDataUrl(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface AuthSessionResponse {
  user: User | null;
  joinedCommunities: JoinedCommunitySummary[];
  customFeeds: CustomFeed[];
  unreadNotifications: number;
  token?: string;
}

export const api = {
  getSession: () => request<AuthSessionResponse>('/api/auth'),
  register: async (payload: {
    username: string;
    password: string;
    displayName?: string;
    bio?: string;
    avatarColor?: string;
  }) => {
    const res = await request<AuthSessionResponse>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'register', ...payload }),
    });
    if (res.token) setToken(res.token);
    return res;
  },
  login: async (username: string, password: string) => {
    const res = await request<AuthSessionResponse>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password }),
    });
    if (res.token) setToken(res.token);
    return res;
  },
  logout: async () => {
    setToken(null);
    return request<{ ok: boolean }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' }),
    });
  },
  updateProfile: (payload: {
    displayName?: string;
    bio?: string;
    avatarColor?: string;
    bannerColor?: string;
    avatarUrl?: string | null;
  }) =>
    request<{ user: User }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateProfile', ...payload }),
    }),
  updateSettings: (settings: UserSettings) =>
    request<{ user: User }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateSettings', settings }),
    }),
  exportData: () =>
    request<Record<string, any>>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'exportData' }),
    }),

  getFeed: (params: {
    feed?: string;
    community?: string;
    customFeedId?: string;
    q?: string;
    searchType?: string;
    flair?: string;
    sort?: PostSort;
    t?: TimeRange;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return request<{
      posts?: Post[];
      comments?: any[];
      communities?: Community[];
      users?: any[];
      total?: number;
      hasMore?: boolean;
    }>(`/api/feed?${qs.toString()}`);
  },

  getPostDetail: (id: string, commentSort: CommentSort = 'best') =>
    request<{ post: Post; comments: CommentItem[] }>(
      `/api/posts?id=${encodeURIComponent(id)}&commentSort=${encodeURIComponent(commentSort)}`
    ),
  createPost: (payload: {
    communityName: string;
    title: string;
    postType: string;
    body: string;
    url?: string;
    media?: Array<{ url: string; caption?: string }>;
    pollOptions?: string[];
    pollDays?: number;
    crosspostOf?: string;
    flair?: { text: string; bg: string; color: string } | null;
    isNsfw?: boolean;
    isSpoiler?: boolean;
    isOc?: boolean;
  }) =>
    request<{ post: Post }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', ...payload }),
    }),
  editPost: (postId: string, body: string) =>
    request<{ ok: boolean; body: string; editedAt: string }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'edit', postId, body }),
    }),
  deletePost: (postId: string) =>
    request<{ ok: boolean }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', postId }),
    }),
  pollVote: (postId: string, optionId: string) =>
    request<{ pollData: Post['pollData']; userPollVote: string }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'pollVote', postId, optionId }),
    }),
  toggleSavePost: (postId: string, save: boolean) =>
    request<{ isSaved: boolean }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ action: save ? 'save' : 'unsave', postId }),
    }),
  toggleHidePost: (postId: string, hide: boolean) =>
    request<{ isHidden: boolean }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ action: hide ? 'hide' : 'unhide', postId }),
    }),
  awardPost: (postId: string, awardId: string) =>
    request<{ awards: Post['awards'] }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ action: 'award', postId, awardId }),
    }),

  createComment: (postId: string, body: string, parentId?: string | null) =>
    request<{ comment: CommentItem }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', postId, body, parentId: parentId || null }),
    }),
  editComment: (commentId: string, body: string) =>
    request<{ ok: boolean; body: string; editedAt: string }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ action: 'edit', commentId, body }),
    }),
  deleteComment: (commentId: string) =>
    request<{ ok: boolean }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', commentId }),
    }),
  toggleSaveComment: (commentId: string, save: boolean) =>
    request<{ isSaved: boolean }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ action: save ? 'save' : 'unsave', commentId }),
    }),
  awardComment: (commentId: string, awardId: string) =>
    request<{ awards: CommentItem['awards'] }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ action: 'award', commentId, awardId }),
    }),

  vote: (targetType: 'post' | 'comment', targetId: string, value: 1 | -1 | 0) =>
    request<{ upvotes: number; downvotes: number; score: number; userVote: number }>('/api/votes', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, value }),
    }),

  getCommunities: (category?: string, q?: string) => {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (q) qs.set('q', q);
    return request<{ communities: Community[] }>(`/api/communities?${qs.toString()}`);
  },
  getCommunity: (name: string) =>
    request<{ community: Community; moderators: CommunityModerator[] }>(
      `/api/communities?name=${encodeURIComponent(name)}`
    ),
  createCommunity: (payload: {
    name: string;
    title: string;
    description: string;
    category: string;
    iconEmoji: string;
    accentColor: string;
    bannerColor: string;
    isNsfw: boolean;
    isUnmoderated: boolean;
  }) =>
    request<{ community: Community }>('/api/communities', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', ...payload }),
    }),
  joinCommunity: (communityId: string, join: boolean) =>
    request<{ isJoined: boolean; memberCount: number }>('/api/communities', {
      method: 'POST',
      body: JSON.stringify({ action: join ? 'join' : 'leave', communityId }),
    }),
  favoriteCommunity: (communityId: string) =>
    request<{ isFavorite: boolean; isJoined: boolean }>('/api/communities', {
      method: 'POST',
      body: JSON.stringify({ action: 'favorite', communityId }),
    }),
  setUserFlair: (communityId: string, userFlair: string | null) =>
    request<{ userFlair: string | null }>('/api/communities', {
      method: 'POST',
      body: JSON.stringify({ action: 'setUserFlair', communityId, userFlair }),
    }),
  updateCommunity: (communityId: string, payload: Record<string, any>) =>
    request<{ community: Community }>('/api/communities', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', communityId, ...payload }),
    }),
  manageCommunityMod: (communityId: string, username: string, add: boolean) =>
    request<{ ok: boolean }>('/api/communities', {
      method: 'POST',
      body: JSON.stringify({ action: add ? 'addMod' : 'removeMod', communityId, username }),
    }),

  getProfile: (username: string) =>
    request<{
      profile: User & { followersCount: number; followingCount: number; isFollowing: boolean; isSelf: boolean };
      posts: Post[];
      comments: any[];
      savedPosts: Post[];
      savedComments: any[];
      upvotedPosts: Post[];
      downvotedPosts: Post[];
      hiddenPosts: Post[];
    }>(`/api/social?resource=profile&username=${encodeURIComponent(username)}`),
  toggleFollow: (targetUserId: string, follow: boolean) =>
    request<{ isFollowing: boolean }>('/api/social', {
      method: 'POST',
      body: JSON.stringify({ action: follow ? 'follow' : 'unfollow', targetUserId }),
    }),
  getNotifications: () =>
    request<{ notifications: NotificationItem[] }>('/api/social?resource=notifications'),
  markNotificationsRead: (notificationId?: string) =>
    request<{ ok: boolean }>('/api/social', {
      method: 'POST',
      body: JSON.stringify({ action: 'markNotificationsRead', notificationId }),
    }),
  getMessages: (roomId = 'global:lobby', peerUsername?: string) => {
    const qs = new URLSearchParams({ resource: 'messages', roomId });
    if (peerUsername) qs.set('peerUsername', peerUsername);
    return request<{ roomId: string; rooms: ChatRoom[]; messages: ChatMessage[] }>(
      `/api/social?${qs.toString()}`
    );
  },
  sendMessage: (payload: { roomId?: string; recipientUsername?: string; body: string }) =>
    request<{ message: ChatMessage }>('/api/social', {
      method: 'POST',
      body: JSON.stringify({ action: 'sendMessage', ...payload }),
    }),
  createCustomFeed: (payload: { name: string; description: string; communityIds: string[] }) =>
    request<{ customFeed: CustomFeed }>('/api/social', {
      method: 'POST',
      body: JSON.stringify({ action: 'createCustomFeed', ...payload }),
    }),
  deleteCustomFeed: (id: string) =>
    request<{ ok: boolean }>('/api/social', {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteCustomFeed', id }),
    }),

  getModLogs: (community?: string, action?: string) => {
    const qs = new URLSearchParams();
    if (community) qs.set('community', community);
    if (action) qs.set('action', action);
    return request<{ logs: ModLogEntry[] }>(`/api/mod?${qs.toString()}`);
  },
  modAction: (payload: Record<string, any>) =>
    request<Record<string, any>>('/api/mod', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
