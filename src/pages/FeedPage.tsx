import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FolderOpen, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { Post, PostSort, TimeRange } from '../types';
import { OpenRedLogo } from '../components/Avatar';
import { FeedToolbar } from '../components/Modals';
import { PostCard } from '../components/PostCard';
import { RightSidebar } from '../components/RightSidebar';

export function FeedPage({ mode }: { mode: 'home' | 'popular' | 'all' | 'custom' }) {
  const { feedId } = useParams();
  const {
    user,
    allCommunities,
    customFeeds,
    settings,
    openAuthModal,
    setCreateCommunityOpen,
    refreshSession,
    showToast,
  } = useApp();

  const [sort, setSort] = useState<PostSort>(mode === 'popular' ? 'top' : 'hot');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const customFeed = mode === 'custom' ? customFeeds.find((f) => f.id === feedId) : null;

  const loadPosts = useCallback(
    async (offset = 0, append = false) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await api.getFeed({
          feed: mode,
          customFeedId: mode === 'custom' ? feedId : undefined,
          sort,
          t: timeRange,
          limit: 20,
          offset,
        });
        const nextPosts = res.posts || [];
        setPosts((prev) => (append ? [...prev, ...nextPosts] : nextPosts));
        setHasMore(Boolean(res.hasMore));
      } catch (err: any) {
        showToast(err.message || 'Failed to load feed', 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [mode, feedId, sort, timeRange, showToast]
  );

  useEffect(() => {
    loadPosts(0, false);
  }, [loadPosts]);

  // Personal client-side free-speech filters
  const visiblePosts = posts.filter((p) => {
    if (!settings.showNsfw && p.isNsfw) return false;
    if (settings.mutedCommunities.includes(p.communityName)) return false;
    if (settings.blockedUsers.includes(p.authorUsername)) return false;
    if (settings.mutedKeywords.length > 0) {
      const hay = `${p.title} ${p.body}`.toLowerCase();
      if (settings.mutedKeywords.some((kw) => kw && hay.includes(kw.toLowerCase()))) {
        return false;
      }
    }
    return true;
  });

  const handleDeleteCustomFeed = async () => {
    if (!customFeed || !confirm(`Delete custom feed "${customFeed.name}"?`)) return;
    await api.deleteCustomFeed(customFeed.id);
    await refreshSession();
    showToast('Custom feed deleted', 'info');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] gap-6 px-3 py-4 sm:px-6">
      <div className="min-w-0 flex-1">
        {mode === 'custom' && customFeed && (
          <div className="or-panel mb-3 flex items-center justify-between rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF4500]/15 text-[#FF4500]">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{customFeed.name}</h1>
                <p className="text-xs text-[var(--or-text-secondary)]">
                  {customFeed.description || `${customFeed.communityIds.length} communities`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDeleteCustomFeed}
              className="rounded-full p-2 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[#f87171]"
              title="Delete custom feed"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        <FeedToolbar
          sort={sort}
          onSortChange={setSort}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          showTimeFilter={mode === 'popular' || mode === 'all'}
        />

        {loading ? (
          <div className="divide-y divide-[var(--or-border-subtle)]">
            {[1, 2, 3].map((n) => (
              <div key={n} className="py-4 space-y-2.5">
                <div className="h-4 w-44 animate-pulse rounded bg-[var(--or-pill)]" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--or-pill)]" />
                <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--or-surface-elevated)]" />
              </div>
            ))}
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="or-panel mt-2 rounded-3xl px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FF4500]/10">
              <OpenRedLogo size={38} />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight">
              {allCommunities.length === 0
                ? 'Welcome to OpenRed — the feed is yours'
                : 'No posts here yet'}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--or-text-secondary)]">
              {allCommunities.length === 0
                ? 'Zero fake posts, zero pre-filled subreddits, and zero shadowbans. Create the first community and start real uncensored discussions.'
                : 'Be the first to start a thread, share a link, upload a gallery, or run a poll.'}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!user) openAuthModal('register');
                  else setCreateCommunityOpen(true);
                }}
                className="or-btn-join inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" /> Create a Community
              </button>

              {allCommunities.length > 0 ? (
                <Link
                  to="/submit"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#FF4500] px-5 text-sm font-semibold text-white hover:bg-[#d93900]"
                >
                  <Sparkles className="h-4 w-4" /> Create Post
                </Link>
              ) : (
                !user && (
                  <button
                    type="button"
                    onClick={() => openAuthModal('register')}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#FF4500] px-5 text-sm font-semibold text-white hover:bg-[#d93900]"
                  >
                    Sign Up (No Email)
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div>
            {visiblePosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                viewMode={settings.viewMode}
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

        {hasMore && !loading && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => loadPosts(posts.length, true)}
              className="rounded-full border border-[var(--or-border)] px-6 py-2 text-xs font-semibold hover:bg-[var(--or-surface-hover)]"
            >
              {loadingMore ? 'Loading...' : 'Load More Posts'}
            </button>
          </div>
        )}
      </div>

      <RightSidebar />
    </div>
  );
}
