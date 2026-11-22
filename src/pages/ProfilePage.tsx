import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Award, Calendar, MessageSquare, ShieldAlert, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { Post } from '../types';
import { formatCount, timeAgo } from '../utils/format';
import { MarkdownBody } from '../utils/markdown';
import { UserAvatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';

type ProfileTab = 'overview' | 'posts' | 'comments' | 'saved' | 'hidden' | 'upvoted' | 'downvoted';

export function ProfilePage() {
  const { username = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as ProfileTab) || 'overview';
  const { user, settings, openAuthModal, openChatWithUser, updateSettings, showToast } = useApp();

  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProfile(username);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = searchParams.get('tab') as ProfileTab | null;
    if (t) setTab(t);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--or-surface)]" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-extrabold">u/{username} not found</h1>
      </div>
    );
  }

  const profile = data.profile;
  const isBlocked = settings.blockedUsers.includes(profile.username);

  const handleFollow = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    try {
      const res = await api.toggleFollow(profile.id, !profile.isFollowing);
      setData((d: any) => ({
        ...d,
        profile: {
          ...d.profile,
          isFollowing: res.isFollowing,
          followersCount: d.profile.followersCount + (res.isFollowing ? 1 : -1),
        },
      }));
      showToast(
        res.isFollowing ? `Following u/${profile.username}` : `Unfollowed u/${profile.username}`,
        'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Follow failed', 'error');
    }
  };

  const handleToggleBlock = () => {
    const next = isBlocked
      ? settings.blockedUsers.filter((u) => u !== profile.username)
      : [...settings.blockedUsers, profile.username];
    updateSettings({ blockedUsers: next });
    showToast(
      isBlocked ? `Unblocked u/${profile.username}` : `Blocked u/${profile.username} locally`,
      'info'
    );
  };

  const tabs: Array<{ id: ProfileTab; label: string; selfOnly?: boolean }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'posts', label: `Posts (${data.posts.length})` },
    { id: 'comments', label: `Comments (${data.comments.length})` },
    { id: 'saved', label: 'Saved', selfOnly: true },
    { id: 'hidden', label: 'Hidden', selfOnly: true },
    { id: 'upvoted', label: 'Upvoted', selfOnly: true },
    { id: 'downvoted', label: 'Downvoted', selfOnly: true },
  ];

  const renderPostList = (list: Post[]) =>
    list.length === 0 ? (
      <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-8 text-center text-sm text-[var(--or-text-secondary)]">
        Nothing here yet.
      </div>
    ) : (
      <div className="space-y-3">
        {list.map((p) => (
          <PostCard key={p.id} post={p} viewMode={settings.viewMode} />
        ))}
      </div>
    );

  const renderComments = (list: any[]) =>
    list.length === 0 ? (
      <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-8 text-center text-sm text-[var(--or-text-secondary)]">
        No comments yet.
      </div>
    ) : (
      <div className="space-y-2.5">
        {list.map((c) => (
          <Link
            key={c.id}
            to={`/r/${c.communityName}/comments/${c.postId}`}
            className="block rounded-2xl border border-[var(--or-border-subtle)] bg-[var(--or-surface)] p-4 hover:border-[var(--or-border)]"
          >
            <div className="text-xs text-[var(--or-text-secondary)]">
              Commented on <strong className="text-[var(--or-text)]">{c.postTitle}</strong> in{' '}
              <span className="font-semibold">r/{c.communityName}</span> • {formatCount(c.score)} pts
              • {timeAgo(c.createdAt)}
            </div>
            <div className="mt-2">
              <MarkdownBody content={c.body} />
            </div>
          </Link>
        ))}
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-[1100px] gap-6 px-3 py-4 sm:px-5">
      <div className="min-w-0 flex-1 space-y-4">
        {/* Profile Header Card */}
        <div className="overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)]">
          <div style={{ backgroundColor: profile.bannerColor }} className="h-24 w-full" />
          <div className="px-5 pb-5">
            <div className="flex flex-wrap items-end justify-between gap-3 -mt-8">
              <div className="flex items-end gap-3">
                <div className="rounded-full border-4 border-[var(--or-surface)]">
                  <UserAvatar
                    username={profile.username}
                    color={profile.avatarColor}
                    avatarUrl={profile.avatarUrl}
                    size={72}
                  />
                </div>
                <div className="pb-1">
                  <h1 className="text-xl font-extrabold">{profile.displayName}</h1>
                  <div className="text-xs text-[var(--or-text-secondary)]">
                    u/{profile.username} • {profile.followersCount} followers
                  </div>
                </div>
              </div>

              {profile.isSelf ? (
                <Link
                  to="/settings"
                  className="rounded-full border border-[var(--or-border)] px-4 py-1.5 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
                >
                  Edit Profile &amp; Filters
                </Link>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleFollow}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold ${
                      profile.isFollowing
                        ? 'border border-[var(--or-border)]'
                        : 'bg-[#FF4500] text-white'
                    }`}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {profile.isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openChatWithUser(profile.username)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--or-border)] px-4 py-1.5 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Chat
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--or-border)] px-3 py-1.5 text-xs font-bold text-[var(--or-text-secondary)] hover:text-[#ef4444]"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              )}
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm text-[var(--or-text-secondary)]">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--or-border-subtle)] pb-2">
          {tabs
            .filter((t) => !t.selfOnly || profile.isSelf)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setSearchParams({ tab: t.id });
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                  tab === t.id
                    ? 'bg-[var(--or-pill)] text-[#FF4500]'
                    : 'text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-4">
            {renderPostList(data.posts.slice(0, 5))}
            {data.comments.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-[var(--or-text-secondary)]">
                  Recent Comments
                </h2>
                {renderComments(data.comments.slice(0, 5))}
              </>
            )}
          </div>
        )}
        {tab === 'posts' && renderPostList(data.posts)}
        {tab === 'comments' && renderComments(data.comments)}
        {tab === 'saved' && (
          <div className="space-y-4">
            {renderPostList(data.savedPosts || [])}
            {(data.savedComments || []).length > 0 && renderComments(data.savedComments)}
          </div>
        )}
        {tab === 'hidden' && renderPostList(data.hiddenPosts || [])}
        {tab === 'upvoted' && renderPostList(data.upvotedPosts || [])}
        {tab === 'downvoted' && renderPostList(data.downvotedPosts || [])}
      </div>

      {/* Right Profile Stats Sidebar */}
      <aside className="hidden w-[300px] shrink-0 space-y-4 xl:block">
        <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-4 space-y-3">
          <div className="text-sm font-extrabold">u/{profile.username}</div>
          <div className="grid grid-cols-2 gap-3 border-y border-[var(--or-border-subtle)] py-3">
            <div>
              <div className="text-base font-bold">{formatCount(profile.postKarma)}</div>
              <div className="text-[11px] text-[var(--or-text-secondary)]">Post Karma</div>
            </div>
            <div>
              <div className="text-base font-bold">{formatCount(profile.commentKarma)}</div>
              <div className="text-[11px] text-[var(--or-text-secondary)]">Comment Karma</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--or-text-secondary)]">
            <Calendar className="h-4 w-4" />
            Cake Day: {new Date(profile.createdAt).toLocaleDateString()}
          </div>
        </div>

        {profile.trophies && profile.trophies.length > 0 && (
          <div className="rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-4">
            <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--or-text-muted)]">
              <Award className="h-3.5 w-3.5 text-[#eab308]" /> Trophy Case
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.trophies.map((tr: string) => (
                <span
                  key={tr}
                  className="rounded-full border border-[var(--or-border)] bg-[var(--or-surface-elevated)] px-2.5 py-1 text-xs font-semibold"
                >
                  🏅 {tr}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
