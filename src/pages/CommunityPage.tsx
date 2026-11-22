import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Settings, ShieldOff, Star, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { Community, CommunityModerator, Post, PostSort, TimeRange } from '../types';
import { formatCount } from '../utils/format';
import { FeedToolbar } from '../components/Modals';
import { PostCard } from '../components/PostCard';
import { RightSidebar } from '../components/RightSidebar';

export function CommunityPage() {
  const { name = '' } = useParams();
  const {
    user,
    settings,
    toggleJoinCommunity,
    toggleFavoriteCommunity,
    recordRecentCommunity,
    refreshCommunities,
    showToast,
  } = useApp();

  const [community, setCommunity] = useState<Community | null>(null);
  const [moderators, setModerators] = useState<CommunityModerator[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<PostSort>('hot');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [activeFlair, setActiveFlair] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modToolsOpen, setModToolsOpen] = useState(false);

  // Mod Tools Form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [newModUsername, setNewModUsername] = useState('');
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newFlairText, setNewFlairText] = useState('');
  const [newFlairColor, setNewFlairColor] = useState('#FF4500');

  const loadCommunity = useCallback(async () => {
    setNotFound(false);
    try {
      const res = await api.getCommunity(name);
      setCommunity(res.community);
      setModerators(res.moderators);
      setEditTitle(res.community.title);
      setEditDesc(res.community.description);
      setEditEmoji(res.community.iconEmoji);
      recordRecentCommunity(res.community.name);
    } catch {
      setNotFound(true);
    }
  }, [name, recordRecentCommunity]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFeed({
        feed: 'community',
        community: name,
        flair: activeFlair,
        sort,
        t: timeRange,
        limit: 40,
      });
      setPosts(res.posts || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [name, activeFlair, sort, timeRange]);

  useEffect(() => {
    setActiveFlair('');
    loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">r/{name} does not exist yet</h1>
        <p className="mt-2 text-sm text-[var(--or-text-secondary)]">
          Nobody owns this name yet — you can create it right now or browse existing communities.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/explore" className="rounded-full bg-[#FF4500] px-5 py-2 text-sm font-bold text-white">
            Explore Communities
          </Link>
        </div>
      </div>
    );
  }

  const canModerate = Boolean(
    community && (community.role === 'owner' || community.role === 'mod' || user?.isAdmin)
  );

  const handleJoin = async () => {
    if (!community) return;
    const joined = await toggleJoinCommunity(community.id, Boolean(community.isJoined));
    setCommunity((c) =>
      c
        ? {
            ...c,
            isJoined: joined,
            memberCount: c.memberCount + (joined === Boolean(c.isJoined) ? 0 : joined ? 1 : -1),
          }
        : c
    );
  };

  const handleSaveModSettings = async () => {
    if (!community) return;
    try {
      const res = await api.updateCommunity(community.id, {
        title: editTitle,
        description: editDesc,
        iconEmoji: editEmoji,
        rules: community.rules,
        postFlairs: community.postFlairs,
        reason: 'Updated community title, description, rules, or flairs.',
      });
      setCommunity(res.community);
      await refreshCommunities();
      setModToolsOpen(false);
      showToast('Community settings saved & logged publicly!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  const handleAddRule = () => {
    if (!community || !newRuleTitle.trim()) return;
    setCommunity({
      ...community,
      rules: [
        ...community.rules,
        { title: newRuleTitle.trim(), description: newRuleDesc.trim() },
      ],
    });
    setNewRuleTitle('');
    setNewRuleDesc('');
  };

  const handleAddPostFlair = () => {
    if (!community || !newFlairText.trim()) return;
    setCommunity({
      ...community,
      postFlairs: [
        ...community.postFlairs,
        { text: newFlairText.trim(), bg: newFlairColor, color: '#FFFFFF' },
      ],
    });
    setNewFlairText('');
  };

  const handleAppointMod = async () => {
    if (!community || !newModUsername.trim()) return;
    try {
      await api.manageCommunityMod(community.id, newModUsername.trim().replace(/^u\//i, ''), true);
      setNewModUsername('');
      await loadCommunity();
      showToast('Moderator added & logged publicly!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add moderator', 'error');
    }
  };

  return (
    <div className="w-full">
      {/* Community Banner */}
      {community && (
        <div className="border-b border-[var(--or-border)] bg-[var(--or-surface)]">
          <div
            style={{ backgroundColor: community.bannerColor }}
            className="h-24 w-full sm:h-32"
          />
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-end justify-between gap-3 px-4 pb-4">
            <div className="flex items-end gap-3 -mt-6">
              <div
                style={{ backgroundColor: community.accentColor }}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--or-surface)] text-3xl text-white shadow-lg sm:h-20 sm:w-20"
              >
                {community.iconEmoji}
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold sm:text-2xl">r/{community.name}</h1>
                  {community.isUnmoderated && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2.5 py-0.5 text-xs font-bold text-[#f59e0b]">
                      <ShieldOff className="h-3.5 w-3.5" /> Zero-Mod Free-Speech Zone
                    </span>
                  )}
                  {community.isNsfw && (
                    <span className="rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-xs font-bold text-[#ef4444]">
                      18+ NSFW
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--or-text-secondary)]">
                  {community.title} • {formatCount(community.memberCount)} members
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/submit?r=${community.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--or-border)] px-4 py-1.5 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
              >
                <Plus className="h-4 w-4" /> Create Post
              </Link>

              <button
                type="button"
                onClick={handleJoin}
                className={`h-9 rounded-full px-5 text-xs font-semibold ${
                  community.isJoined
                    ? 'border border-[var(--or-border)] hover:bg-[var(--or-surface-hover)]'
                    : 'or-btn-join'
                }`}
              >
                {community.isJoined ? 'Joined' : 'Join'}
              </button>

              <button
                type="button"
                onClick={() => toggleFavoriteCommunity(community.id)}
                title="Favorite community"
                className="rounded-full border border-[var(--or-border)] p-2 hover:bg-[var(--or-surface-hover)]"
              >
                <Star
                  className={`h-4 w-4 ${
                    community.isFavorite ? 'fill-[#eab308] text-[#eab308]' : 'text-[var(--or-text-secondary)]'
                  }`}
                />
              </button>

              {canModerate && (
                <button
                  type="button"
                  onClick={() => setModToolsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--or-border)] px-3 py-1.5 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
                >
                  <Settings className="h-3.5 w-3.5" /> Mod Tools
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="mx-auto flex w-full max-w-[1100px] gap-6 px-3 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          {activeFlair && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--or-border)] bg-[var(--or-surface)] px-4 py-2 text-xs">
              <span>
                Filtering by flair: <strong>{activeFlair}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveFlair('')}
                className="font-bold text-[#4fbcff] hover:underline"
              >
                Clear filter
              </button>
            </div>
          )}

          <FeedToolbar
            sort={sort}
            onSortChange={setSort}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-36 animate-pulse rounded-2xl border border-[var(--or-border-subtle)] bg-[var(--or-surface)]"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-10 text-center">
              <p className="font-bold">No posts in r/{name} yet</p>
              <Link
                to={`/submit?r=${name}`}
                className="mt-3 inline-block rounded-full bg-[#FF4500] px-5 py-2 text-xs font-bold text-white"
              >
                Be the first to post
              </Link>
            </div>
          ) : (
            <div className={settings.viewMode === 'classic' ? 'overflow-hidden rounded-2xl border border-[var(--or-border-subtle)]' : 'space-y-3'}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  viewMode={settings.viewMode}
                  canModerate={canModerate}
                  onUpdated={(updated) =>
                    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                  }
                  onRemovedFromFeed={(id) =>
                    setPosts((prev) => prev.filter((p) => p.id !== id))
                  }
                />
              ))}
            </div>
          )}
        </div>

        <RightSidebar
          community={community}
          moderators={moderators}
          activeFlair={activeFlair}
          onSelectFlair={setActiveFlair}
          onCommunityUpdated={setCommunity}
          onOpenModTools={() => setModToolsOpen(true)}
        />
      </div>

      {/* Mod Tools Modal */}
      {modToolsOpen && community && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">r/{community.name} Mod Tools</h2>
              <button
                type="button"
                onClick={() => setModToolsOpen(false)}
                className="rounded-full p-1 text-[var(--or-text-secondary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3">
                  <label className="mb-1 block font-bold">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="or-input w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">Emoji</label>
                  <input
                    type="text"
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    className="or-input w-full rounded-xl px-3 py-2 text-center text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="or-input w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              {/* Rules Editor */}
              <div className="rounded-xl border border-[var(--or-border)] p-3 space-y-2">
                <div className="font-bold">Community Rules ({community.rules.length})</div>
                {community.rules.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--or-surface-elevated)] px-2.5 py-1.5">
                    <span>
                      <strong>{r.title}</strong> — {r.description}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCommunity({
                          ...community,
                          rules: community.rules.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-[#ef4444]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRuleTitle}
                    onChange={(e) => setNewRuleTitle(e.target.value)}
                    placeholder="Rule title"
                    className="or-input flex-1 rounded-lg px-2.5 py-1.5"
                  />
                  <input
                    type="text"
                    value={newRuleDesc}
                    onChange={(e) => setNewRuleDesc(e.target.value)}
                    placeholder="Rule details"
                    className="or-input flex-1 rounded-lg px-2.5 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="rounded-lg bg-[var(--or-pill)] px-3 py-1.5 font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Post Flairs Editor */}
              <div className="rounded-xl border border-[var(--or-border)] p-3 space-y-2">
                <div className="font-bold">Post Flairs</div>
                <div className="flex flex-wrap gap-1.5">
                  {community.postFlairs.map((pf, i) => (
                    <span
                      key={i}
                      style={{ backgroundColor: pf.bg, color: pf.color }}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold"
                    >
                      {pf.text}
                      <button
                        type="button"
                        onClick={() =>
                          setCommunity({
                            ...community,
                            postFlairs: community.postFlairs.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFlairText}
                    onChange={(e) => setNewFlairText(e.target.value)}
                    placeholder="New flair label"
                    className="or-input flex-1 rounded-lg px-2.5 py-1.5"
                  />
                  <input
                    type="color"
                    value={newFlairColor}
                    onChange={(e) => setNewFlairColor(e.target.value)}
                    className="h-8 w-10 rounded border border-[var(--or-border)] bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={handleAddPostFlair}
                    className="rounded-lg bg-[var(--or-pill)] px-3 py-1.5 font-bold"
                  >
                    Add Flair
                  </button>
                </div>
              </div>

              {/* Appoint Moderator */}
              {(community.role === 'owner' || user?.isAdmin) && (
                <div className="rounded-xl border border-[var(--or-border)] p-3 space-y-2">
                  <div className="font-bold">Appoint Moderator</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newModUsername}
                      onChange={(e) => setNewModUsername(e.target.value)}
                      placeholder="Username"
                      className="or-input flex-1 rounded-lg px-2.5 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={handleAppointMod}
                      className="rounded-lg bg-[#46D160] px-3 py-1.5 font-bold text-black"
                    >
                      Add Mod
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Link
                  to={`/modlog?community=${community.name}`}
                  className="mr-auto rounded-full border border-[var(--or-border)] px-4 py-2 font-bold text-[#46D160]"
                >
                  View Public Mod Log
                </Link>
                <button
                  type="button"
                  onClick={() => setModToolsOpen(false)}
                  className="rounded-full px-4 py-2 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModSettings}
                  className="rounded-full bg-[#FF4500] px-5 py-2 font-bold text-white"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
