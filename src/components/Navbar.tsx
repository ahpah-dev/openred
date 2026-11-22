import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  ChevronDown,
  LayoutList,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Scale,
  Search,
  Settings,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { formatCount, timeAgo } from '../utils/format';
import { NotificationItem, ViewMode } from '../types';
import { OpenRedLogo, UserAvatar } from './Avatar';

export function Navbar() {
  const {
    user,
    allCommunities,
    unreadNotifications,
    setUnreadNotifications,
    settings,
    toggleTheme,
    setViewMode,
    openAuthModal,
    logout,
    leftSidebarOpen,
    setLeftSidebarOpen,
    setMobileSidebarOpen,
    chatOpen,
    setChatOpen,
    setShortcutsOpen,
    searchInputRef,
  } = useApp();

  const navigate = useNavigate();
  const location = useLocation();
  const communityMatch = location.pathname.match(/^\/r\/([^/]+)/);
  const scopedCommunity = communityMatch ? communityMatch[1] : null;

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const openNotifications = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      try {
        const res = await api.getNotifications();
        setNotifications(res.notifications.slice(0, 8));
      } catch {
        // ignore
      }
    }
  };

  const handleMarkAllRead = async () => {
    await api.markNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotifications(0);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchFocused(false);
    const qs = new URLSearchParams({ q: trimmed });
    if (scopedCommunity) qs.set('community', scopedCommunity);
    navigate(`/search?${qs.toString()}`);
  };

  const matchingCommunities = query.trim()
    ? allCommunities
        .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 5)
    : allCommunities.slice(0, 5);

  const totalKarma = user ? user.postKarma + user.commentKarma : 0;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-3 border-b border-[var(--or-border-subtle)] bg-[var(--or-surface)]/95 px-3 backdrop-blur-md sm:px-4">
      {/* Left: Hamburger + Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth < 1024) {
              setMobileSidebarOpen(true);
            } else {
              setLeftSidebarOpen(!leftSidebarOpen);
            }
          }}
          title="Toggle navigation"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/" className="flex items-center gap-2 pr-1">
          <OpenRedLogo size={32} />
          <span className="hidden text-[22px] font-bold tracking-[-0.03em] sm:inline">
            open<span className="text-[#FF4500]">red</span>
          </span>
        </Link>
      </div>

      {/* Center: Modern Reddit Search Pill */}
      <div ref={searchBoxRef} className="relative flex-1 max-w-[580px]">
        <form
          onSubmit={handleSearchSubmit}
          className={`flex h-10 items-center gap-2 rounded-full border px-3.5 transition-all ${
            searchFocused
              ? 'border-[var(--or-text-secondary)] bg-[var(--or-surface)] shadow-sm'
              : 'border-transparent bg-[var(--or-pill)] hover:bg-[var(--or-pill-hover)]'
          }`}
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--or-text-secondary)]" />
          {scopedCommunity && (
            <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--or-surface-elevated)] px-2.5 py-0.5 text-xs font-semibold border border-[var(--or-border)]">
              r/{scopedCommunity}
            </span>
          )}
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={scopedCommunity ? `Search in r/${scopedCommunity}` : 'Search OpenRed'}
            className="w-full bg-transparent text-sm text-[var(--or-text)] placeholder-[var(--or-text-secondary)] focus:outline-none"
          />
          {!query && !searchFocused && (
            <kbd className="hidden sm:inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--or-border)] text-[10px] font-semibold text-[var(--or-text-muted)]">
              /
            </kbd>
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-full p-0.5 text-[var(--or-text-secondary)] hover:text-[var(--or-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {searchFocused && (matchingCommunities.length > 0 || query.trim()) && (
          <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] shadow-2xl">
            {matchingCommunities.length > 0 && (
              <>
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--or-text-muted)]">
                  {query.trim() ? 'Communities' : 'Active Communities'}
                </div>
                {matchingCommunities.map((c) => (
                  <Link
                    key={c.id}
                    to={`/r/${c.name}`}
                    onClick={() => setSearchFocused(false)}
                    className="flex items-center justify-between px-4 py-2 hover:bg-[var(--or-surface-hover)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        style={{ backgroundColor: c.accentColor }}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-white"
                      >
                        {c.iconEmoji}
                      </span>
                      <div>
                        <div className="text-sm font-semibold">r/{c.name}</div>
                        <div className="text-xs text-[var(--or-text-secondary)] tabular-nums">
                          {formatCount(c.memberCount)} members
                        </div>
                      </div>
                    </div>
                    {c.isUnmoderated && (
                      <span className="rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10px] font-semibold text-[#f59e0b]">
                        Unmoderated
                      </span>
                    )}
                  </Link>
                ))}
              </>
            )}
            {query.trim() && (
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="flex w-full items-center gap-2 border-t border-[var(--or-border-subtle)] px-4 py-2.5 text-left text-sm font-medium text-[#4fbcff] hover:bg-[var(--or-surface-hover)]"
              >
                <Search className="h-4 w-4" />
                Search for &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (!user) openAuthModal('login');
            else navigate(scopedCommunity ? `/submit?r=${scopedCommunity}` : '/submit');
          }}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[var(--or-text)] hover:bg-[var(--or-surface-hover)]"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden md:inline">Create</span>
        </button>

        <button
          type="button"
          onClick={() => setChatOpen(!chatOpen)}
          title="Open Chat"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            chatOpen
              ? 'bg-[var(--or-pill)] text-[#FF4500]'
              : 'text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]'
          }`}
        >
          <MessageCircle className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={openNotifications}
            title="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF4500] px-1 text-[10px] font-bold text-white tabular-nums">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 sm:w-96 overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--or-border-subtle)] px-4 py-3">
                <span className="text-sm font-bold">Notifications</span>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="font-semibold text-[#4fbcff] hover:underline"
                  >
                    Mark all read
                  </button>
                  <Link
                    to="/inbox"
                    onClick={() => setNotifOpen(false)}
                    className="font-semibold text-[var(--or-text-secondary)] hover:text-[var(--or-text)]"
                  >
                    See all
                  </Link>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-[var(--or-text-secondary)]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      to={n.link}
                      onClick={() => {
                        setNotifOpen(false);
                        if (!n.isRead) {
                          api.markNotificationsRead(n.id).catch(() => {});
                          setUnreadNotifications((c) => Math.max(0, c - 1));
                        }
                      }}
                      className={`flex gap-3 border-b border-[var(--or-border-subtle)] px-4 py-3 hover:bg-[var(--or-surface-hover)] ${
                        !n.isRead ? 'bg-[#FF4500]/5' : ''
                      }`}
                    >
                      <UserAvatar
                        username={n.actorUsername || 'O'}
                        color={n.actorAvatarColor}
                        size={28}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[var(--or-text)]">{n.title}</div>
                        {n.body && (
                          <div className="mt-0.5 truncate text-xs text-[var(--or-text-secondary)]">
                            {n.body}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-[var(--or-text-muted)]">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                      {!n.isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FF4500]" />
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {user ? (
          <div ref={userMenuRef} className="relative ml-1">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-[var(--or-surface-hover)]"
            >
              <UserAvatar
                username={user.username}
                color={user.avatarColor}
                avatarUrl={user.avatarUrl}
                size={30}
              />
              <div className="hidden text-left lg:block">
                <div className="text-xs font-semibold leading-tight">u/{user.username}</div>
                <div className="text-[11px] text-[var(--or-text-secondary)] leading-tight tabular-nums">
                  {formatCount(totalKarma)} karma
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--or-text-secondary)]" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] py-1.5 shadow-2xl">
                <Link
                  to={`/u/${user.username}`}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--or-surface-hover)]"
                >
                  <UserIcon className="h-4 w-4 text-[var(--or-text-secondary)]" />
                  <div>
                    <div className="font-semibold">View Profile</div>
                    <div className="text-xs text-[var(--or-text-secondary)]">u/{user.username}</div>
                  </div>
                </Link>

                <Link
                  to={`/u/${user.username}?tab=saved`}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--or-surface-hover)]"
                >
                  <Bookmark className="h-4 w-4 text-[var(--or-text-secondary)]" />
                  Saved
                </Link>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-[var(--or-surface-hover)]"
                >
                  <span className="flex items-center gap-3">
                    {settings.theme === 'dark' ? (
                      <Moon className="h-4 w-4 text-[var(--or-text-secondary)]" />
                    ) : (
                      <Sun className="h-4 w-4 text-[var(--or-text-secondary)]" />
                    )}
                    {settings.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </span>
                  <span className="rounded-full bg-[var(--or-pill)] px-2.5 py-0.5 text-[11px] font-semibold">
                    {settings.theme === 'dark' ? 'On' : 'Off'}
                  </span>
                </button>

                <div className="border-y border-[var(--or-border-subtle)] px-4 py-2.5">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[var(--or-text-secondary)]">
                    <LayoutList className="h-3.5 w-3.5" /> Feed View
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['card', 'compact', 'classic'] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setViewMode(mode)}
                        className={`rounded-lg py-1 text-xs font-semibold capitalize ${
                          settings.viewMode === mode
                            ? 'bg-[#FF4500] text-white'
                            : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)] hover:text-[var(--or-text)]'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <Link
                  to="/modlog"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--or-surface-hover)]"
                >
                  <Scale className="h-4 w-4 text-[var(--or-text-secondary)]" />
                  Public Mod Log
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--or-surface-hover)]"
                >
                  <Settings className="h-4 w-4 text-[var(--or-text-secondary)]" />
                  Settings
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setShortcutsOpen(true);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-[var(--or-surface-hover)]"
                >
                  <span>Shortcuts</span>
                  <kbd className="rounded border border-[var(--or-border)] px-1.5 py-0.5 text-[10px]">
                    ?
                  </kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-3 border-t border-[var(--or-border-subtle)] px-4 py-2.5 text-sm text-[#f87171] hover:bg-[var(--or-surface-hover)]"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="ml-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              title={settings.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
            >
              {settings.theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="h-9 rounded-full bg-[#FF4500] px-4 text-sm font-semibold text-white hover:bg-[#d93900]"
            >
              Log In
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
