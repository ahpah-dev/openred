import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  LayoutGrid,
  LayoutList,
  Rows3,
  ShieldOff,
  Sparkles,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { PostSort, TimeRange, ViewMode } from '../types';
import { AWARDS, COMMUNITY_CATEGORIES } from '../utils/format';

export function FeedToolbar({
  sort,
  onSortChange,
  timeRange,
  onTimeRangeChange,
  showTimeFilter = false,
}: {
  sort: PostSort;
  onSortChange: (s: PostSort) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (t: TimeRange) => void;
  showTimeFilter?: boolean;
}) {
  const { settings, setViewMode } = useApp();

  const sortOptions: Array<{ id: PostSort; label: string; icon: React.ReactNode }> = [
    { id: 'hot', label: 'Hot', icon: <Flame className="h-3.5 w-3.5" /> },
    { id: 'best', label: 'Best', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: 'new', label: 'New', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'top', label: 'Top', icon: <Trophy className="h-3.5 w-3.5" /> },
    { id: 'rising', label: 'Rising', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { id: 'controversial', label: 'Controversial', icon: <ShieldOff className="h-3.5 w-3.5" /> },
  ];

  const needTime = showTimeFilter || sort === 'top' || sort === 'controversial';

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--or-border-subtle)] pb-2.5">
      <div className="flex flex-wrap items-center gap-1">
        {sortOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSortChange(opt.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
              sort === opt.id
                ? 'bg-[var(--or-pill)] text-[var(--or-text)]'
                : 'text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}

        {needTime && (
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
            aria-label="Time range"
            className="or-input ml-1 h-8 rounded-full px-3 text-xs font-semibold"
          >
            <option value="hour">Past Hour</option>
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        )}
      </div>

      {/* View Mode Switcher */}
      <div className="flex items-center gap-0.5 rounded-full bg-[var(--or-pill)] p-0.5">
        {(
          [
            { id: 'card', title: 'Card View', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
            { id: 'compact', title: 'Compact View', icon: <Rows3 className="h-3.5 w-3.5" /> },
            { id: 'classic', title: 'Classic Old-Reddit View', icon: <LayoutList className="h-3.5 w-3.5" /> },
          ] as Array<{ id: ViewMode; title: string; icon: React.ReactNode }>
        ).map((v) => (
          <button
            key={v.id}
            type="button"
            title={v.title}
            onClick={() => setViewMode(v.id)}
            className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors ${
              settings.viewMode === v.id
                ? 'bg-[var(--or-surface)] text-[var(--or-text)] shadow-sm'
                : 'text-[var(--or-text-secondary)] hover:text-[var(--or-text)]'
            }`}
          >
            {v.icon}
            <span className="hidden sm:inline capitalize">{v.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const AVATAR_COLORS = ['#FF4500', '#115BCA', '#EC4899', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4'];

export function AllModals() {
  const {
    authModal,
    openAuthModal,
    closeAuthModal,
    applyAuthResult,
    refreshCommunities,
    createCommunityOpen,
    setCreateCommunityOpen,
    customFeedOpen,
    setCustomFeedOpen,
    allCommunities,
    refreshSession,
    shortcutsOpen,
    setShortcutsOpen,
    awardTarget,
    setAwardTarget,
    crosspostTarget,
    setCrosspostTarget,
    lightbox,
    setLightbox,
    showToast,
  } = useApp();

  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#FF4500');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [commName, setCommName] = useState('');
  const [commTitle, setCommTitle] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [commCategory, setCommCategory] = useState('General');
  const [commEmoji, setCommEmoji] = useState('🔥');
  const [commColor, setCommColor] = useState('#FF4500');
  const [commNsfw, setCommNsfw] = useState(false);
  const [commUnmod, setCommUnmod] = useState(false);
  const [commBusy, setCommBusy] = useState(false);

  const [cfName, setCfName] = useState('');
  const [cfDesc, setCfDesc] = useState('');
  const [cfSelectedIds, setCfSelectedIds] = useState<string[]>([]);

  const [xpCommunity, setXpCommunity] = useState('');
  const [xpTitle, setXpTitle] = useState('');

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const res =
        authModal === 'register'
          ? await api.register({ username, password, displayName, avatarColor })
          : await api.login(username, password);
      applyAuthResult(res);
      await refreshCommunities();
      showToast(
        authModal === 'register'
          ? `Welcome to OpenRed, u/${res.user?.username}!`
          : `Signed in as u/${res.user?.username}`,
        'success'
      );
      setUsername('');
      setPassword('');
      setDisplayName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommBusy(true);
    try {
      const res = await api.createCommunity({
        name: commName.trim(),
        title: commTitle.trim() || commName.trim(),
        description: commDesc.trim(),
        category: commCategory,
        iconEmoji: commEmoji || '🔥',
        accentColor: commColor,
        bannerColor: '#181C1F',
        isNsfw: commNsfw,
        isUnmoderated: commUnmod,
      });
      await Promise.all([refreshSession(), refreshCommunities()]);
      setCreateCommunityOpen(false);
      setCommName('');
      setCommTitle('');
      setCommDesc('');
      showToast(`Created r/${res.community.name}!`, 'success');
      navigate(`/r/${res.community.name}`);
    } catch (err: any) {
      showToast(err.message || 'Could not create community', 'error');
    } finally {
      setCommBusy(false);
    }
  };

  const handleCreateCustomFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createCustomFeed({
        name: cfName.trim(),
        description: cfDesc.trim(),
        communityIds: cfSelectedIds,
      });
      await refreshSession();
      setCustomFeedOpen(false);
      setCfName('');
      setCfDesc('');
      setCfSelectedIds([]);
      showToast(`Created custom feed "${res.customFeed.name}"`, 'success');
      navigate(`/feed/${res.customFeed.id}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create custom feed', 'error');
    }
  };

  const handleAward = async (awardId: string) => {
    if (!awardTarget) return;
    try {
      const res =
        awardTarget.type === 'post'
          ? await api.awardPost(awardTarget.id, awardId)
          : await api.awardComment(awardTarget.id, awardId);
      awardTarget.onAwarded?.(res.awards);
      setAwardTarget(null);
      showToast('Award sent! +5 karma granted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Award failed', 'error');
    }
  };

  const handleCrosspostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crosspostTarget) return;
    const targetComm = xpCommunity || allCommunities[0]?.name;
    if (!targetComm) {
      showToast('Create a destination community first', 'error');
      return;
    }
    try {
      const res = await api.createPost({
        communityName: targetComm,
        title: xpTitle.trim() || crosspostTarget.title,
        postType: 'crosspost',
        body: '',
        crosspostOf: crosspostTarget.id,
      });
      setCrosspostTarget(null);
      setXpTitle('');
      showToast(`Crossposted to r/${targetComm}!`, 'success');
      navigate(`/r/${targetComm}/comments/${res.post.id}`);
    } catch (err: any) {
      showToast(err.message || 'Crosspost failed', 'error');
    }
  };

  return (
    <>
      {authModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {authModal === 'register' ? 'Sign Up' : 'Log In'}
              </h2>
              <button
                type="button"
                onClick={closeAuthModal}
                className="rounded-full p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--or-text-secondary)]">
              {authModal === 'register'
                ? 'No email or phone required. Pick a username and dive in.'
                : 'Welcome back to OpenRed.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--or-text-secondary)]">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Letters, numbers, underscores"
                  className="or-input w-full rounded-2xl px-4 py-2.5 text-sm"
                />
              </div>

              {authModal === 'register' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--or-text-secondary)]">
                      Display Name (optional)
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Optional display name"
                      className="or-input w-full rounded-2xl px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--or-text-secondary)]">
                      Avatar Color
                    </label>
                    <div className="flex gap-2">
                      {AVATAR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAvatarColor(c)}
                          style={{ backgroundColor: c }}
                          className={`h-7 w-7 rounded-full ${
                            avatarColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#181c1f]' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--or-text-secondary)]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="or-input w-full rounded-2xl px-4 py-2.5 text-sm"
                />
              </div>

              {authError && (
                <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="h-11 w-full rounded-full bg-[#FF4500] text-sm font-semibold text-white hover:bg-[#d93900] disabled:opacity-50"
              >
                {authBusy ? 'Please wait...' : authModal === 'register' ? 'Create Account' : 'Log In'}
              </button>
            </form>

            <div className="mt-4 text-center text-xs text-[var(--or-text-secondary)]">
              {authModal === 'register' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError('');
                      openAuthModal('login');
                    }}
                    className="font-semibold text-[#4fbcff] hover:underline"
                  >
                    Log In
                  </button>
                </>
              ) : (
                <>
                  New to OpenRed?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError('');
                      openAuthModal('register');
                    }}
                    className="font-semibold text-[#4fbcff] hover:underline"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {createCommunityOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px] overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Create a community</h2>
              <button
                type="button"
                onClick={() => setCreateCommunityOpen(false)}
                className="rounded-full p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCommunity} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold">Community Name (r/...)</label>
                  <input
                    type="text"
                    required
                    value={commName}
                    onChange={(e) => setCommName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="e.g. gaming"
                    className="or-input w-full rounded-2xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Icon</label>
                  <input
                    type="text"
                    value={commEmoji}
                    onChange={(e) => setCommEmoji(e.target.value)}
                    className="or-input w-full rounded-2xl px-3 py-2 text-center text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Title</label>
                <input
                  type="text"
                  value={commTitle}
                  onChange={(e) => setCommTitle(e.target.value)}
                  placeholder="Short headline for your community"
                  className="or-input w-full rounded-2xl px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Description</label>
                <textarea
                  rows={3}
                  value={commDesc}
                  onChange={(e) => setCommDesc(e.target.value)}
                  placeholder="Tell people what this community is about"
                  className="or-input w-full rounded-2xl px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Category</label>
                  <select
                    value={commCategory}
                    onChange={(e) => setCommCategory(e.target.value)}
                    className="or-input w-full rounded-2xl px-3 py-2 text-sm"
                  >
                    {COMMUNITY_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Accent Color</label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCommColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full ${commColor === c ? 'ring-2 ring-white' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-2xl border border-[var(--or-border)] bg-[var(--or-panel-bg)] p-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={commUnmod}
                  onChange={(e) => setCommUnmod(e.target.checked)}
                  className="mt-0.5 accent-[#FF4500]"
                />
                <div>
                  <div className="font-bold text-[#f59e0b]">Zero-Moderation Free-Speech Zone</div>
                  <div className="text-[var(--or-text-secondary)]">
                    Disables post removals, thread locks, and bans in backend code.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={commNsfw}
                  onChange={(e) => setCommNsfw(e.target.checked)}
                  className="accent-[#FF4500]"
                />
                <span className="font-semibold">18+ / NSFW Community</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateCommunityOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold hover:bg-[var(--or-surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commBusy || commName.length < 3}
                  className="or-btn-join rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {commBusy ? 'Creating...' : `Create r/${commName || '...'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {customFeedOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Create Custom Feed</h2>
              <button
                type="button"
                onClick={() => setCustomFeedOpen(false)}
                className="rounded-full p-1 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomFeed} className="mt-4 space-y-3">
              <input
                type="text"
                required
                value={cfName}
                onChange={(e) => setCfName(e.target.value)}
                placeholder="Feed name"
                className="or-input w-full rounded-2xl px-3.5 py-2 text-sm"
              />
              <input
                type="text"
                value={cfDesc}
                onChange={(e) => setCfDesc(e.target.value)}
                placeholder="Optional description"
                className="or-input w-full rounded-2xl px-3.5 py-2 text-sm"
              />
              <div>
                <div className="mb-1.5 text-xs font-semibold text-[var(--or-text-secondary)]">
                  Select Communities ({cfSelectedIds.length})
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-[var(--or-border)] bg-[var(--or-panel-bg)] p-2">
                  {allCommunities.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[var(--or-text-muted)]">
                      No communities exist yet.
                    </div>
                  ) : (
                    allCommunities.map((c) => {
                      const checked = cfSelectedIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--or-surface-hover)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setCfSelectedIds((prev) =>
                                checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                              )
                            }
                          />
                          <span>{c.iconEmoji}</span>
                          <span className="font-semibold">r/{c.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCustomFeedOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#FF4500] px-5 py-2 text-xs font-semibold text-white"
                >
                  Create Feed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {awardTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Give an Award</h2>
              <button
                type="button"
                onClick={() => setAwardTarget(null)}
                className="rounded-full p-1 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--or-text-secondary)]">
              Free community awards grant +5 karma to the author.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {AWARDS.map((aw) => (
                <button
                  key={aw.id}
                  type="button"
                  onClick={() => handleAward(aw.id)}
                  className="flex items-center gap-2.5 rounded-2xl border border-[var(--or-border)] bg-[var(--or-panel-bg)] p-2.5 text-left hover:border-[#FF4500]"
                >
                  <span className="text-2xl">{aw.emoji}</span>
                  <div>
                    <div className="text-xs font-bold">{aw.name}</div>
                    <div className="text-[11px] text-[var(--or-text-secondary)]">{aw.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {crosspostTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Crosspost</h2>
              <button
                type="button"
                onClick={() => setCrosspostTarget(null)}
                className="rounded-full p-1 text-[var(--or-text-secondary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCrosspostSubmit} className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Destination Community</label>
                <select
                  value={xpCommunity || allCommunities[0]?.name || ''}
                  onChange={(e) => setXpCommunity(e.target.value)}
                  className="or-input w-full rounded-2xl px-3 py-2 text-sm"
                >
                  {allCommunities.map((c) => (
                    <option key={c.id} value={c.name}>
                      r/{c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Title (optional override)</label>
                <input
                  type="text"
                  value={xpTitle}
                  onChange={(e) => setXpTitle(e.target.value)}
                  placeholder={crosspostTarget.title}
                  className="or-input w-full rounded-2xl px-3.5 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCrosspostTarget(null)}
                  className="rounded-full px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#FF4500] px-5 py-2 text-xs font-semibold text-white"
                >
                  Crosspost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {shortcutsOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Keyboard Shortcuts</h2>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="rounded-full p-1 text-[var(--or-text-secondary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              {[
                ['/', 'Focus search'],
                ['?', 'Toggle shortcuts'],
                ['Esc', 'Close modals & lightbox'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-[var(--or-text-secondary)]">{label}</span>
                  <kbd className="rounded border border-[var(--or-border)] bg-[var(--or-panel-bg)] px-2 py-0.5 font-mono font-bold">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[var(--or-border-subtle)] pt-3 text-center text-xs">
              <Link
                to="/charter"
                onClick={() => setShortcutsOpen(false)}
                className="text-[#4fbcff] hover:underline"
              >
                OpenRed Free-Speech Charter
              </Link>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/92 p-4"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <X className="h-6 w-6" />
          </button>

          <div onClick={(e) => e.stopPropagation()} className="relative max-h-[85vh] max-w-5xl">
            <img
              src={lightbox.images[lightbox.index]?.url}
              alt={lightbox.images[lightbox.index]?.caption || ''}
              className="max-h-[80vh] max-w-full rounded-xl object-contain"
            />
            {lightbox.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      ...lightbox,
                      index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length,
                    })
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      ...lightbox,
                      index: (lightbox.index + 1) % lightbox.images.length,
                    })
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          {lightbox.images[lightbox.index]?.caption && (
            <div className="mt-3 text-sm text-white/90">
              {lightbox.images[lightbox.index].caption}
            </div>
          )}
        </div>
      )}
    </>
  );
}
