import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Scale,
  Shield,
  ShieldOff,
  Tag,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { formatCount, timeAgo } from '../utils/format';
import type { Community, CommunityModerator } from '../types';
import { UserAvatar } from './Avatar';

interface RightSidebarProps {
  community?: Community | null;
  moderators?: CommunityModerator[];
  activeFlair?: string;
  onSelectFlair?: (flair: string) => void;
  onCommunityUpdated?: (c: Community) => void;
  onOpenModTools?: () => void;
}

export function RightSidebar({
  community,
  moderators = [],
  activeFlair = '',
  onSelectFlair,
  onCommunityUpdated,
  onOpenModTools,
}: RightSidebarProps) {
  const {
    user,
    allCommunities,
    recentPosts,
    openAuthModal,
    toggleJoinCommunity,
    setCreateCommunityOpen,
    showToast,
  } = useApp();

  const [openRuleIdx, setOpenRuleIdx] = useState<number | null>(0);
  const [flairPickerOpen, setFlairPickerOpen] = useState(false);

  if (community) {
    const canMod = community.role === 'owner' || community.role === 'mod' || user?.isAdmin;

    const handlePickUserFlair = async (flair: string | null) => {
      if (!user) {
        openAuthModal('login');
        return;
      }
      try {
        const res = await api.setUserFlair(community.id, flair);
        onCommunityUpdated?.({ ...community, userFlair: res.userFlair, isJoined: true });
        setFlairPickerOpen(false);
        showToast(flair ? `Flair set to "${flair}"` : 'User flair cleared', 'success');
      } catch (err: any) {
        showToast(err.message || 'Failed to update flair', 'error');
      }
    };

    return (
      <aside className="hidden w-[312px] shrink-0 space-y-4 xl:block">
        <div className="or-panel rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold leading-snug">{community.title}</h2>
              <div className="mt-0.5 text-xs text-[var(--or-text-secondary)]">
                r/{community.name} • Created {timeAgo(community.createdAt)}
              </div>
            </div>
            {community.isUnmoderated ? (
              <span
                title="Zero-Moderation Free-Speech Zone"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10px] font-bold text-[#f59e0b]"
              >
                <ShieldOff className="h-3 w-3" /> Unmod
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#46D160]/15 px-2 py-0.5 text-[10px] font-bold text-[#46D160]">
                <Shield className="h-3 w-3" /> Public Log
              </span>
            )}
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-[var(--or-text-secondary)]">
            {community.description || 'No description yet.'}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[var(--or-border-subtle)] py-3">
            <div>
              <div className="text-base font-bold tabular-nums">{formatCount(community.memberCount)}</div>
              <div className="text-[11px] text-[var(--or-text-secondary)]">Members</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-base font-bold tabular-nums">
                <span className="h-2 w-2 rounded-full bg-[#46D160]" />
                {Math.max(1, Math.round(community.memberCount * 0.05))}
              </div>
              <div className="text-[11px] text-[var(--or-text-secondary)]">Online</div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <Link
              to={`/submit?r=${community.name}`}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-[#FF4500] text-xs font-semibold text-white hover:bg-[#d93900]"
            >
              <Plus className="h-4 w-4" /> Create Post
            </Link>

            {canMod && onOpenModTools && (
              <button
                type="button"
                onClick={onOpenModTools}
                className="h-9 w-full rounded-full border border-[var(--or-border)] text-xs font-semibold hover:bg-[var(--or-surface-hover)]"
              >
                Mod Tools
              </button>
            )}
          </div>

          {community.userFlairs && community.userFlairs.length > 0 && (
            <div className="mt-4 border-t border-[var(--or-border-subtle)] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--or-text-muted)]">
                  User Flair
                </span>
                <button
                  type="button"
                  onClick={() => setFlairPickerOpen((v) => !v)}
                  className="text-xs font-semibold text-[#4fbcff] hover:underline"
                >
                  {flairPickerOpen ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="mt-1.5 text-xs">
                {community.userFlair ? (
                  <span className="inline-block rounded-full bg-[var(--or-pill)] px-2.5 py-0.5 font-semibold">
                    {community.userFlair}
                  </span>
                ) : (
                  <span className="text-[var(--or-text-muted)]">None selected</span>
                )}
              </div>
              {flairPickerOpen && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {community.userFlairs.map((uf) => (
                    <button
                      key={uf}
                      type="button"
                      onClick={() => handlePickUserFlair(uf)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        community.userFlair === uf
                          ? 'bg-[#FF4500] text-white'
                          : 'bg-[var(--or-pill)] hover:bg-[var(--or-pill-hover)]'
                      }`}
                    >
                      {uf}
                    </button>
                  ))}
                  {community.userFlair && (
                    <button
                      type="button"
                      onClick={() => handlePickUserFlair(null)}
                      className="rounded-full border border-[var(--or-border)] px-2.5 py-1 text-xs text-[var(--or-text-secondary)]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {community.postFlairs && community.postFlairs.length > 0 && onSelectFlair && (
          <div className="or-panel rounded-2xl p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--or-text-muted)]">
                <Tag className="h-3.5 w-3.5" /> Filter by Flair
              </span>
              {activeFlair && (
                <button
                  type="button"
                  onClick={() => onSelectFlair('')}
                  className="text-xs font-semibold text-[#4fbcff] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {community.postFlairs.map((pf) => (
                <button
                  key={pf.text}
                  type="button"
                  onClick={() => onSelectFlair(activeFlair === pf.text ? '' : pf.text)}
                  style={{
                    backgroundColor: activeFlair === pf.text ? pf.bg : undefined,
                    color: activeFlair === pf.text ? pf.color : undefined,
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeFlair === pf.text
                      ? 'ring-2 ring-white/40'
                      : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)] hover:text-[var(--or-text)]'
                  }`}
                >
                  {pf.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="or-panel rounded-2xl p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--or-text-muted)]">
            r/{community.name} Rules
          </div>
          {community.rules.length === 0 ? (
            <p className="text-xs text-[var(--or-text-secondary)]">No rules set.</p>
          ) : (
            <div className="divide-y divide-[var(--or-border-subtle)]">
              {community.rules.map((r, idx) => (
                <div key={idx} className="py-2">
                  <button
                    type="button"
                    onClick={() => setOpenRuleIdx(openRuleIdx === idx ? null : idx)}
                    className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold"
                  >
                    <span>
                      {idx + 1}. {r.title}
                    </span>
                    {openRuleIdx === idx ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--or-text-muted)]" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--or-text-muted)]" />
                    )}
                  </button>
                  {openRuleIdx === idx && r.description && (
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--or-text-secondary)]">
                      {r.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="or-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--or-text-muted)]">
              Moderators
            </span>
            <Link
              to={`/modlog?community=${community.name}`}
              className="flex items-center gap-1 text-xs font-semibold text-[#46D160] hover:underline"
            >
              <Scale className="h-3.5 w-3.5" /> Public Log
            </Link>
          </div>
          <div className="space-y-1.5">
            {moderators.map((m) => (
              <Link
                key={m.userId}
                to={`/u/${m.username}`}
                className="flex items-center justify-between rounded-lg px-1.5 py-1 hover:bg-[var(--or-surface-hover)]"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar username={m.username} color={m.avatarColor} size={24} />
                  <span className="text-xs font-semibold">u/{m.username}</span>
                </div>
                <span className="rounded bg-[var(--or-pill)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--or-text-secondary)]">
                  {m.role}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[312px] shrink-0 space-y-4 xl:block">
      {/* Communities Panel */}
      <div className="or-panel rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--or-text-muted)]">
            {allCommunities.length > 0 ? 'Communities' : 'Start a Community'}
          </span>
          {allCommunities.length > 0 && (
            <Link to="/explore" className="text-xs font-semibold text-[#4fbcff] hover:underline">
              See all
            </Link>
          )}
        </div>

        {allCommunities.length === 0 ? (
          <div>
            <p className="text-[13px] leading-relaxed text-[var(--or-text-secondary)]">
              OpenRed starts completely blank — no pre-filled subreddits or fake posts. Claim any
              community name you want.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!user) openAuthModal('register');
                else setCreateCommunityOpen(true);
              }}
              className="or-btn-join mt-3.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold"
            >
              <Plus className="h-4 w-4" /> Create a Community
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {allCommunities.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <Link to={`/r/${c.name}`} className="flex min-w-0 items-center gap-2.5">
                  <span
                    style={{ backgroundColor: c.accentColor }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-white"
                  >
                    {c.iconEmoji}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold hover:underline">
                      r/{c.name}
                    </div>
                    <div className="text-[11px] text-[var(--or-text-secondary)] tabular-nums">
                      {formatCount(c.memberCount)} {c.memberCount === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleJoinCommunity(c.id, Boolean(c.isJoined))}
                  className={`h-7 shrink-0 rounded-full px-3 text-xs font-semibold ${
                    c.isJoined
                      ? 'border border-[var(--or-border)] text-[var(--or-text)] hover:bg-[var(--or-surface-hover)]'
                      : 'or-btn-join'
                  }`}
                >
                  {c.isJoined ? 'Joined' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transparency & Free Speech Panel */}
      <div className="or-panel rounded-2xl p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--or-text-muted)]">
          OpenRed Principles
        </div>
        <ul className="mt-2.5 space-y-2 text-xs text-[var(--or-text-secondary)]">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#FF4500]">●</span>
            <span>Zero shadowbans or covert suppression.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#46D160]">●</span>
            <span>Every mod action is public at /modlog.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#4fbcff]">●</span>
            <span>No email required. Filter locally in /settings.</span>
          </li>
        </ul>
        <div className="mt-3.5 flex items-center justify-between border-t border-[var(--or-border-subtle)] pt-3 text-xs">
          <Link to="/modlog" className="font-semibold text-[#46D160] hover:underline">
            Public Mod Log
          </Link>
          <Link
            to="/charter"
            className="font-semibold text-[var(--or-text-secondary)] hover:text-[var(--or-text)]"
          >
            Charter →
          </Link>
        </div>
      </div>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <div className="or-panel rounded-2xl p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--or-text-muted)]">
            Recent Posts
          </div>
          <div className="divide-y divide-[var(--or-border-subtle)]">
            {recentPosts.map((rp) => (
              <Link
                key={rp.id}
                to={`/r/${rp.communityName}/comments/${rp.id}`}
                className="block py-2.5 hover:opacity-90"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--or-text-secondary)]">
                  <span>{rp.communityIconEmoji}</span>
                  <span>r/{rp.communityName}</span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold hover:underline">
                  {rp.title}
                </div>
                <div className="mt-1 text-[11px] text-[var(--or-text-muted)] tabular-nums">
                  {formatCount(rp.score)} upvotes • {rp.commentCount} comments
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
