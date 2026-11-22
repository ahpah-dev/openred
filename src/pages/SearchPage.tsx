import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { Community, Post, PostSort, TimeRange } from '../types';
import { formatCount, timeAgo } from '../utils/format';
import { MarkdownBody } from '../utils/markdown';
import { UserAvatar } from '../components/Avatar';
import { FeedToolbar } from '../components/Modals';
import { PostCard } from '../components/PostCard';

type SearchTab = 'posts' | 'comments' | 'communities' | 'users';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const scopedComm = searchParams.get('community') || '';
  const { settings } = useApp();

  const [tab, setTab] = useState<SearchTab>('posts');
  const [sort, setSort] = useState<PostSort>('top');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) return;
    setLoading(true);
    api
      .getFeed({
        feed: 'search',
        q,
        community: scopedComm,
        searchType: tab,
        sort,
        t: timeRange,
        limit: 40,
      })
      .then((res) => {
        if (tab === 'posts') setPosts(res.posts || []);
        else if (tab === 'comments') setComments(res.comments || []);
        else if (tab === 'communities') setCommunities(res.communities || []);
        else if (tab === 'users') setUsers(res.users || []);
      })
      .finally(() => setLoading(false));
  }, [q, scopedComm, tab, sort, timeRange]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5">
      <div className="mb-3">
        <h1 className="text-lg font-extrabold">
          Search results for &ldquo;{q}&rdquo;
          {scopedComm && <span className="ml-2 text-sm text-[#FF4500]">in r/{scopedComm}</span>}
        </h1>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            { id: 'posts', label: 'Posts' },
            { id: 'comments', label: 'Comments' },
            { id: 'communities', label: 'Communities' },
            { id: 'users', label: 'People' },
          ] as Array<{ id: SearchTab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold ${
              tab === t.id
                ? 'bg-[#FF4500] text-white'
                : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <FeedToolbar
          sort={sort}
          onSortChange={setSort}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          showTimeFilter
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-2xl bg-[var(--or-surface)]" />
          ))}
        </div>
      ) : tab === 'posts' ? (
        posts.length === 0 ? (
          <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-10 text-center text-sm text-[var(--or-text-secondary)]">
            No matching posts found.
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} viewMode={settings.viewMode} />
            ))}
          </div>
        )
      ) : tab === 'comments' ? (
        comments.length === 0 ? (
          <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-10 text-center text-sm text-[var(--or-text-secondary)]">
            No matching comments found.
          </div>
        ) : (
          <div className="space-y-2.5">
            {comments.map((c) => (
              <Link
                key={c.id}
                to={`/r/${c.communityName}/comments/${c.postId}`}
                className="block rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-4 hover:border-[var(--or-text-secondary)]"
              >
                <div className="text-xs text-[var(--or-text-secondary)]">
                  <strong>u/{c.authorUsername}</strong> on &ldquo;{c.postTitle}&rdquo; in r/
                  {c.communityName} • {timeAgo(c.createdAt)}
                </div>
                <div className="mt-2">
                  <MarkdownBody content={c.body} />
                </div>
              </Link>
            ))}
          </div>
        )
      ) : tab === 'communities' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {communities.map((c) => (
            <Link
              key={c.id}
              to={`/r/${c.name}`}
              className="flex items-center gap-3 rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-4 hover:border-[#FF4500]"
            >
              <span
                style={{ backgroundColor: c.accentColor }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-white"
              >
                {c.iconEmoji}
              </span>
              <div>
                <div className="font-bold">r/{c.name}</div>
                <div className="text-xs text-[var(--or-text-secondary)]">
                  {formatCount(c.memberCount)} members
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <Link
              key={u.id}
              to={`/u/${u.username}`}
              className="flex items-center gap-3 rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-4 hover:border-[#FF4500]"
            >
              <UserAvatar username={u.username} color={u.avatarColor} avatarUrl={u.avatarUrl} size={40} />
              <div>
                <div className="font-bold">u/{u.username}</div>
                <div className="text-xs text-[var(--or-text-secondary)]">
                  {formatCount(u.postKarma + u.commentKarma)} karma
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
