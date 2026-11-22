import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type {
  Community,
  CustomFeed,
  JoinedCommunitySummary,
  Post,
  PostDraft,
  ThemeMode,
  User,
  UserSettings,
  ViewMode,
} from '../types';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  viewMode: 'card',
  showNsfw: true,
  blurNsfw: true,
  blurSpoilers: true,
  mutedKeywords: [],
  mutedCommunities: [],
  blockedUsers: [],
};

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export interface RecentPostEntry {
  id: string;
  communityName: string;
  communityIconEmoji: string;
  title: string;
  score: number;
  commentCount: number;
}

interface ToastItem {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'error';
}

interface AppContextValue {
  user: User | null;
  authLoading: boolean;
  joinedCommunities: JoinedCommunitySummary[];
  allCommunities: Community[];
  customFeeds: CustomFeed[];
  unreadNotifications: number;
  settings: UserSettings;
  recentCommunities: string[];
  recentPosts: RecentPostEntry[];
  drafts: PostDraft[];
  leftSidebarOpen: boolean;
  setLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  authModal: 'login' | 'register' | null;
  openAuthModal: (mode: 'login' | 'register') => void;
  closeAuthModal: () => void;
  createCommunityOpen: boolean;
  setCreateCommunityOpen: (v: boolean) => void;
  customFeedOpen: boolean;
  setCustomFeedOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  awardTarget: { type: 'post' | 'comment'; id: string; onAwarded?: (awards: any[]) => void } | null;
  setAwardTarget: (
    target: { type: 'post' | 'comment'; id: string; onAwarded?: (awards: any[]) => void } | null
  ) => void;
  crosspostTarget: Post | null;
  setCrosspostTarget: (post: Post | null) => void;
  lightbox: { images: Array<{ url: string; caption?: string }>; index: number } | null;
  setLightbox: (
    val: { images: Array<{ url: string; caption?: string }>; index: number } | null
  ) => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  chatRoomId: string;
  setChatRoomId: (room: string) => void;
  openChatWithUser: (username: string) => Promise<void>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  refreshSession: () => Promise<void>;
  refreshCommunities: () => Promise<void>;
  applyAuthResult: (data: any) => void;
  logout: () => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  toggleTheme: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleJoinCommunity: (communityId: string, currentlyJoined: boolean) => Promise<boolean>;
  toggleFavoriteCommunity: (communityId: string) => Promise<void>;
  recordRecentCommunity: (name: string) => void;
  recordRecentPost: (post: Post) => void;
  saveDraft: (draft: Omit<PostDraft, 'id' | 'savedAt'>) => void;
  deleteDraft: (id: string) => void;
  setUnreadNotifications: React.Dispatch<React.SetStateAction<number>>;
  showToast: (message: string, kind?: 'info' | 'success' | 'error') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunitySummary[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [settings, setSettings] = useState<UserSettings>(() =>
    readLocalJson<UserSettings>('openred_settings_v1', DEFAULT_SETTINGS)
  );
  const [recentCommunities, setRecentCommunities] = useState<string[]>(() =>
    readLocalJson<string[]>('openred_recent_comms_v2', [])
  );
  const [recentPosts, setRecentPosts] = useState<RecentPostEntry[]>(() =>
    readLocalJson<RecentPostEntry[]>('openred_recent_posts_v1', [])
  );
  const [drafts, setDrafts] = useState<PostDraft[]>(() =>
    readLocalJson<PostDraft[]>('openred_drafts_v1', [])
  );

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [customFeedOpen, setCustomFeedOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [awardTarget, setAwardTarget] = useState<{
    type: 'post' | 'comment';
    id: string;
    onAwarded?: (awards: any[]) => void;
  } | null>(null);
  const [crosspostTarget, setCrosspostTarget] = useState<Post | null>(null);
  const [lightbox, setLightbox] = useState<{
    images: Array<{ url: string; caption?: string }>;
    index: number;
  } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatRoomId, setChatRoomId] = useState('global:lobby');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback(
    (message: string, kind: 'info' | 'success' | 'error' = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    try {
      localStorage.setItem('openred_settings_v1', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const refreshCommunities = useCallback(async () => {
    try {
      const res = await api.getCommunities();
      setAllCommunities(res.communities);
    } catch {
      // ignore transient error
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await api.getSession();
      setUser(res.user);
      setJoinedCommunities(res.joinedCommunities || []);
      setCustomFeeds(res.customFeeds || []);
      setUnreadNotifications(res.unreadNotifications || 0);
      if (res.user?.settings) {
        setSettings((prev) => ({ ...prev, ...res.user!.settings }));
      }
    } catch {
      // ignore
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
    refreshCommunities();
  }, [refreshSession, refreshCommunities]);

  const applyAuthResult = useCallback((data: any) => {
    if (data.user) {
      setUser(data.user);
      if (data.user.settings) setSettings((prev) => ({ ...prev, ...data.user.settings }));
    }
    if (Array.isArray(data.joinedCommunities)) setJoinedCommunities(data.joinedCommunities);
    if (Array.isArray(data.customFeeds)) setCustomFeeds(data.customFeeds);
    if (typeof data.unreadNotifications === 'number') {
      setUnreadNotifications(data.unreadNotifications);
    }
    setAuthModal(null);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setJoinedCommunities([]);
    setCustomFeeds([]);
    setUnreadNotifications(0);
    showToast('Signed out', 'info');
  }, [showToast]);

  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      if (user) {
        try {
          const res = await api.updateSettings(next);
          setUser(res.user);
        } catch (err: any) {
          showToast(err.message || 'Failed to save settings', 'error');
        }
      }
    },
    [settings, user, showToast]
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  }, [settings.theme, updateSettings]);

  const setViewMode = useCallback(
    (viewMode: ViewMode) => {
      updateSettings({ viewMode });
    },
    [updateSettings]
  );

  const toggleJoinCommunity = useCallback(
    async (communityId: string, currentlyJoined: boolean) => {
      if (!user) {
        setAuthModal('login');
        return false;
      }
      try {
        const res = await api.joinCommunity(communityId, !currentlyJoined);
        await Promise.all([refreshSession(), refreshCommunities()]);
        showToast(
          res.isJoined ? 'Joined community!' : 'Left community',
          res.isJoined ? 'success' : 'info'
        );
        return res.isJoined;
      } catch (err: any) {
        showToast(err.message || 'Could not update membership', 'error');
        return currentlyJoined;
      }
    },
    [user, refreshSession, refreshCommunities, showToast]
  );

  const toggleFavoriteCommunity = useCallback(
    async (communityId: string) => {
      if (!user) {
        setAuthModal('login');
        return;
      }
      try {
        const res = await api.favoriteCommunity(communityId);
        await refreshSession();
        showToast(
          res.isFavorite ? 'Added to favorites' : 'Removed from favorites',
          'info'
        );
      } catch (err: any) {
        showToast(err.message || 'Failed to toggle favorite', 'error');
      }
    },
    [user, refreshSession, showToast]
  );

  const recordRecentCommunity = useCallback((name: string) => {
    setRecentCommunities((prev) => {
      const next = [name, ...prev.filter((c) => c.toLowerCase() !== name.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem('openred_recent_comms_v2', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const recordRecentPost = useCallback((post: Post) => {
    setRecentPosts((prev) => {
      const entry: RecentPostEntry = {
        id: post.id,
        communityName: post.communityName,
        communityIconEmoji: post.communityIconEmoji,
        title: post.title,
        score: post.score,
        commentCount: post.commentCount,
      };
      const next = [entry, ...prev.filter((p) => p.id !== post.id)].slice(0, 5);
      try {
        localStorage.setItem('openred_recent_posts_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const saveDraft = useCallback(
    (draft: Omit<PostDraft, 'id' | 'savedAt'>) => {
      const item: PostDraft = {
        ...draft,
        id: `drf_${Date.now()}`,
        savedAt: new Date().toISOString(),
      };
      setDrafts((prev) => {
        const next = [item, ...prev].slice(0, 15);
        try {
          localStorage.setItem('openred_drafts_v1', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      showToast('Draft saved locally', 'success');
    },
    [showToast]
  );

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      try {
        localStorage.setItem('openred_drafts_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openChatWithUser = useCallback(
    async (username: string) => {
      if (!user) {
        setAuthModal('login');
        return;
      }
      try {
        const res = await api.getMessages('global:lobby', username);
        setChatRoomId(res.roomId);
        setChatOpen(true);
      } catch (err: any) {
        showToast(err.message || 'Could not start chat', 'error');
      }
    },
    [user, showToast]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditing) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setLightbox(null);
        setShortcutsOpen(false);
        setAuthModal(null);
        setAwardTarget(null);
        setCrosspostTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        joinedCommunities,
        allCommunities,
        customFeeds,
        unreadNotifications,
        settings,
        recentCommunities,
        recentPosts,
        drafts,
        leftSidebarOpen,
        setLeftSidebarOpen,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        authModal,
        openAuthModal: (m) => setAuthModal(m),
        closeAuthModal: () => setAuthModal(null),
        createCommunityOpen,
        setCreateCommunityOpen,
        customFeedOpen,
        setCustomFeedOpen,
        shortcutsOpen,
        setShortcutsOpen,
        awardTarget,
        setAwardTarget,
        crosspostTarget,
        setCrosspostTarget,
        lightbox,
        setLightbox,
        chatOpen,
        setChatOpen,
        chatRoomId,
        setChatRoomId,
        openChatWithUser,
        searchInputRef,
        refreshSession,
        refreshCommunities,
        applyAuthResult,
        logout,
        updateSettings,
        toggleTheme,
        setViewMode,
        toggleJoinCommunity,
        toggleFavoriteCommunity,
        recordRecentCommunity,
        recordRecentPost,
        saveDraft,
        deleteDraft,
        setUnreadNotifications,
        showToast,
      }}
    >
      {children}
      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-full px-4 py-2 text-xs font-semibold shadow-lg border ${
              t.kind === 'error'
                ? 'bg-[#7f1d1d] border-[#ef4444] text-white'
                : t.kind === 'success'
                  ? 'bg-[#14532d] border-[#22c55e] text-white'
                  : 'bg-[var(--or-surface-elevated)] border-[var(--or-border)] text-[var(--or-text)]'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
