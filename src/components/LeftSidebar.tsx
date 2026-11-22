import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Compass,
  Flame,
  FolderPlus,
  Globe,
  Home,
  Keyboard,
  Plus,
  Scale,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export function LeftSidebar() {
  const {
    user,
    joinedCommunities,
    allCommunities,
    customFeeds,
    recentCommunities,
    leftSidebarOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    setCreateCommunityOpen,
    setCustomFeedOpen,
    openAuthModal,
    toggleFavoriteCommunity,
    setShortcutsOpen,
  } = useApp();

  const location = useLocation();
  const [customOpen, setCustomOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [commsOpen, setCommsOpen] = useState(true);
  const [resourcesOpen, setResourcesOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path;

  const validRecent = recentCommunities.filter((name) =>
    allCommunities.some((c) => c.name.toLowerCase() === name.toLowerCase())
  );

  const communityList =
    user && joinedCommunities.length > 0
      ? joinedCommunities.map((jc) => ({
          id: jc.communityId,
          name: jc.name,
          iconEmoji: jc.iconEmoji,
          accentColor: jc.accentColor,
          isFavorite: jc.isFavorite,
        }))
      : allCommunities.slice(0, 12).map((c) => ({
          id: c.id,
          name: c.name,
          iconEmoji: c.iconEmoji,
          accentColor: c.accentColor,
          isFavorite: false,
        }));

  const navLinkClass = (active: boolean) =>
    `flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors ${
      active
        ? 'bg-[var(--or-pill)] font-semibold text-[var(--or-text)]'
        : 'text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]'
    }`;

  const navContent = (
    <div className="flex h-full flex-col gap-0.5 overflow-y-auto px-3 py-3">
      {/* Primary Feeds */}
      <Link to="/" onClick={() => setMobileSidebarOpen(false)} className={navLinkClass(isActive('/'))}>
        <Home className="h-[18px] w-[18px]" />
        Home
      </Link>

      <Link
        to="/popular"
        onClick={() => setMobileSidebarOpen(false)}
        className={navLinkClass(isActive('/popular'))}
      >
        <Flame className="h-[18px] w-[18px]" />
        Popular
      </Link>

      <Link
        to="/explore"
        onClick={() => setMobileSidebarOpen(false)}
        className={navLinkClass(isActive('/explore'))}
      >
        <Compass className="h-[18px] w-[18px]" />
        Explore
      </Link>

      <Link
        to="/all"
        onClick={() => setMobileSidebarOpen(false)}
        className={navLinkClass(isActive('/all'))}
      >
        <Globe className="h-[18px] w-[18px]" />
        All
      </Link>

      <div className="my-2.5 border-t border-[var(--or-border-subtle)]" />

      {/* Custom Feeds */}
      <button
        type="button"
        onClick={() => setCustomOpen((v) => !v)}
        className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--or-text-muted)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text-secondary)]"
      >
        <span>Custom Feeds</span>
        {customOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {customOpen && (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              if (!user) openAuthModal('login');
              else setCustomFeedOpen(true);
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <FolderPlus className="h-4 w-4" />
            Create a custom feed
          </button>
          {customFeeds.map((cf) => (
            <Link
              key={cf.id}
              to={`/feed/${cf.id}`}
              onClick={() => setMobileSidebarOpen(false)}
              className={navLinkClass(isActive(`/feed/${cf.id}`))}
            >
              <span className="truncate flex-1">{cf.name}</span>
              <span className="text-[11px] text-[var(--or-text-muted)] tabular-nums">
                {cf.communityIds.length}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Recent (only when real communities have been visited) */}
      {validRecent.length > 0 && (
        <>
          <div className="my-2.5 border-t border-[var(--or-border-subtle)]" />
          <button
            type="button"
            onClick={() => setRecentOpen((v) => !v)}
            className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--or-text-muted)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text-secondary)]"
          >
            <span>Recent</span>
            {recentOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {recentOpen && (
            <div className="space-y-0.5">
              {validRecent.map((name) => {
                const comm = allCommunities.find(
                  (c) => c.name.toLowerCase() === name.toLowerCase()
                )!;
                return (
                  <Link
                    key={name}
                    to={`/r/${comm.name}`}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={navLinkClass(isActive(`/r/${comm.name}`))}
                  >
                    <span
                      style={{ backgroundColor: comm.accentColor }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white"
                    >
                      {comm.iconEmoji}
                    </span>
                    <span className="truncate text-[13px]">r/{comm.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="my-2.5 border-t border-[var(--or-border-subtle)]" />

      {/* Communities */}
      <button
        type="button"
        onClick={() => setCommsOpen((v) => !v)}
        className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--or-text-muted)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text-secondary)]"
      >
        <span>Communities</span>
        {commsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {commsOpen && (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              if (!user) openAuthModal('login');
              else setCreateCommunityOpen(true);
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-medium text-[var(--or-text)] hover:bg-[var(--or-surface-hover)]"
          >
            <Plus className="h-4 w-4" />
            Create a community
          </button>

          {communityList.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--or-text-muted)]">
              No communities yet. Start the first one!
            </div>
          ) : (
            communityList.map((c) => (
              <div
                key={c.id}
                className={`group flex h-9 items-center justify-between rounded-lg px-3 ${
                  isActive(`/r/${c.name}`)
                    ? 'bg-[var(--or-pill)] font-semibold text-[var(--or-text)]'
                    : 'text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]'
                }`}
              >
                <Link
                  to={`/r/${c.name}`}
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                >
                  <span
                    style={{ backgroundColor: c.accentColor }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white"
                  >
                    {c.iconEmoji}
                  </span>
                  <span className="truncate text-[13px]">r/{c.name}</span>
                </Link>
                {user && (
                  <button
                    type="button"
                    onClick={() => toggleFavoriteCommunity(c.id)}
                    title={c.isFavorite ? 'Unfavorite' : 'Favorite community'}
                    className={`p-1 transition-opacity ${
                      c.isFavorite
                        ? 'text-[#eab308] opacity-100'
                        : 'opacity-0 group-hover:opacity-100 text-[var(--or-text-muted)] hover:text-[#eab308]'
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${c.isFavorite ? 'fill-[#eab308]' : ''}`} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div className="my-2.5 border-t border-[var(--or-border-subtle)]" />

      {/* Resources */}
      <button
        type="button"
        onClick={() => setResourcesOpen((v) => !v)}
        className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--or-text-muted)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text-secondary)]"
      >
        <span>Resources</span>
        {resourcesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {resourcesOpen && (
        <div className="space-y-0.5 pb-6">
          <Link
            to="/modlog"
            onClick={() => setMobileSidebarOpen(false)}
            className={navLinkClass(isActive('/modlog'))}
          >
            <Scale className="h-[18px] w-[18px]" />
            Public Mod Log
          </Link>
          <Link
            to="/charter"
            onClick={() => setMobileSidebarOpen(false)}
            className={navLinkClass(isActive('/charter'))}
          >
            <ShieldCheck className="h-[18px] w-[18px]" />
            Free-Speech Charter
          </Link>
          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              setShortcutsOpen(true);
            }}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <Keyboard className="h-[18px] w-[18px]" />
            Shortcuts
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {leftSidebarOpen && (
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[256px] shrink-0 border-r border-[var(--or-border-subtle)] bg-[var(--or-surface)] lg:block">
          {navContent}
        </aside>
      )}

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[70] flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-[1px]"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 flex-col border-r border-[var(--or-border)] bg-[var(--or-surface)] shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-[var(--or-border-subtle)] px-4">
              <span className="text-lg font-bold tracking-tight">
                open<span className="text-[#FF4500]">red</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-full p-1 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{navContent}</div>
          </aside>
        </div>
      )}
    </>
  );
}
