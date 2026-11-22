import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ShieldOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COMMUNITY_CATEGORIES, formatCount } from '../utils/format';

export function ExplorePage() {
  const { user, allCommunities, toggleJoinCommunity, setCreateCommunityOpen, openAuthModal } =
    useApp();
  const [category, setCategory] = useState('All');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    return allCommunities.filter((c) => {
      if (category !== 'All' && c.category !== category) return false;
      if (q.trim()) {
        const lower = q.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(lower) ||
          c.title.toLowerCase().includes(lower) ||
          c.description.toLowerCase().includes(lower)
        );
      }
      return true;
    });
  }, [allCommunities, category, q]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Explore Communities</h1>
          <p className="mt-0.5 text-xs text-[var(--or-text-secondary)]">
            Every community on OpenRed is discoverable — zero silent quarantines or deindexing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!user) openAuthModal('login');
            else setCreateCommunityOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4500] px-4 py-2 text-xs font-bold text-white hover:bg-[#ff5414]"
        >
          <Plus className="h-4 w-4" /> Create Community
        </button>
      </div>

      {/* Search + Category Pills */}
      <div className="mt-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--or-text-muted)]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter communities..."
            className="or-input w-full rounded-full py-2 pl-10 pr-4 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {COMMUNITY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                category === cat
                  ? 'bg-[#FF4500] text-white'
                  : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)] hover:text-[var(--or-text)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid or Clean Empty State */}
      {filtered.length === 0 ? (
        <div className="or-panel mt-6 rounded-3xl p-12 text-center">
          <h2 className="text-lg font-bold">
            {allCommunities.length === 0 ? 'No communities yet' : 'No matching communities'}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-[var(--or-text-secondary)]">
            {allCommunities.length === 0
              ? 'Every community on OpenRed is created by real users — no default subreddits. Launch the first one now!'
              : 'Try a different keyword or start a new community for this topic.'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (!user) openAuthModal('register');
              else setCreateCommunityOpen(true);
            }}
            className="or-btn-join mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" /> Create a Community
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="or-panel flex flex-col justify-between rounded-2xl p-4 transition-colors hover:border-[var(--or-border)]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/r/${c.name}`} className="flex items-center gap-2.5 min-w-0">
                    <span
                      style={{ backgroundColor: c.accentColor }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-white"
                    >
                      {c.iconEmoji}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-bold hover:underline">r/{c.name}</div>
                      <div className="text-[11px] text-[var(--or-text-secondary)] tabular-nums">
                        {formatCount(c.memberCount)} {c.memberCount === 1 ? 'member' : 'members'} •{' '}
                        {c.category}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleJoinCommunity(c.id, Boolean(c.isJoined))}
                    className={`h-7 shrink-0 rounded-full px-3.5 text-xs font-semibold ${
                      c.isJoined
                        ? 'border border-[var(--or-border)] hover:bg-[var(--or-surface-hover)]'
                        : 'or-btn-join'
                    }`}
                  >
                    {c.isJoined ? 'Joined' : 'Join'}
                  </button>
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--or-text-secondary)]">
                  {c.description || 'No description yet.'}
                </p>
              </div>

              {(c.isUnmoderated || c.isNsfw) && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--or-border-subtle)] pt-2.5">
                  {c.isUnmoderated && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                      <ShieldOff className="h-3 w-3" /> Unmoderated
                    </span>
                  )}
                  {c.isNsfw && (
                    <span className="rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#ef4444]">
                      NSFW
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
