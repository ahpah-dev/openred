import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowBigDown,
  ArrowBigUp,
  Award,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Repeat2,
  Share2,
  ShieldAlert,
  Trash2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { Post, ViewMode } from '../types';
import { AWARD_MAP, extractDomain, formatCount, timeAgo } from '../utils/format';
import { MarkdownBody } from '../utils/markdown';
import { UserAvatar } from './Avatar';
import { MarkdownEditor } from './MarkdownEditor';

interface PostCardProps {
  post: Post;
  viewMode?: ViewMode;
  isDetail?: boolean;
  canModerate?: boolean;
  onUpdated?: (updated: Post) => void;
  onRemovedFromFeed?: (postId: string) => void;
}

export function PostCard({
  post,
  viewMode = 'card',
  isDetail = false,
  canModerate = false,
  onUpdated,
  onRemovedFromFeed,
}: PostCardProps) {
  const {
    user,
    joinedCommunities,
    settings,
    openAuthModal,
    toggleJoinCommunity,
    setAwardTarget,
    setCrosspostTarget,
    setLightbox,
    updateSettings,
    showToast,
  } = useApp();
  const navigate = useNavigate();

  const [galleryIdx, setGalleryIdx] = useState(0);
  const [revealedBlur, setRevealedBlur] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [savingEdit, setSavingEdit] = useState(false);

  const detailUrl = `/r/${post.communityName}/comments/${post.id}`;
  const isAuthor = Boolean(user && user.id === post.authorId);
  const isJoinedCommunity = joinedCommunities.some((c) => c.communityId === post.communityId);

  const shouldBlurNsfw = post.isNsfw && settings.blurNsfw && !revealedBlur;
  const shouldBlurSpoiler = post.isSpoiler && settings.blurSpoilers && !revealedBlur;
  const isBlurred = (shouldBlurNsfw || shouldBlurSpoiler) && !isDetail;

  const handleVote = async (dir: 1 | -1, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    const nextVal = post.userVote === dir ? 0 : dir;
    const delta = nextVal - post.userVote;
    onUpdated?.({ ...post, userVote: nextVal, score: post.score + delta });
    try {
      const res = await api.vote('post', post.id, nextVal as 1 | -1 | 0);
      onUpdated?.({
        ...post,
        upvotes: res.upvotes,
        downvotes: res.downvotes,
        score: res.score,
        userVote: res.userVote,
      });
    } catch (err: any) {
      onUpdated?.(post);
      showToast(err.message || 'Vote failed', 'error');
    }
  };

  const handlePollVote = async (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('login');
      return;
    }
    try {
      const res = await api.pollVote(post.id, optionId);
      onUpdated?.({ ...post, pollData: res.pollData, userPollVote: res.userPollVote });
      showToast('Vote recorded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Poll vote failed', 'error');
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('login');
      return;
    }
    try {
      const res = await api.toggleSavePost(post.id, !post.isSaved);
      onUpdated?.({ ...post, isSaved: res.isSaved });
      showToast(res.isSaved ? 'Post saved' : 'Removed from saved', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to save post', 'error');
    }
  };

  const handleHide = async () => {
    setMenuOpen(false);
    if (!user) {
      openAuthModal('login');
      return;
    }
    try {
      const res = await api.toggleHidePost(post.id, !post.isHidden);
      onUpdated?.({ ...post, isHidden: res.isHidden });
      if (res.isHidden && !isDetail) onRemovedFromFeed?.(post.id);
      showToast(res.isHidden ? 'Post hidden' : 'Post unhidden', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to hide post', 'error');
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${detailUrl}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    showToast('Link copied', 'success');
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await api.editPost(post.id, editBody);
      onUpdated?.({ ...post, body: res.body, editedAt: res.editedAt });
      setEditing(false);
      showToast('Post updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update post', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!confirm('Delete this post permanently?')) return;
    try {
      await api.deletePost(post.id);
      showToast('Post deleted', 'info');
      if (isDetail) navigate(`/r/${post.communityName}`);
      else onRemovedFromFeed?.(post.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete post', 'error');
    }
  };

  const handleMod = async (action: string) => {
    setMenuOpen(false);
    let reason = 'Moderator action';
    if (action === 'removePost') {
      const input = prompt('Public removal reason (published to /modlog):');
      if (!input || input.trim().length < 3) return;
      reason = input.trim();
    }
    try {
      const res = await api.modAction({ action, postId: post.id, reason });
      onUpdated?.({ ...post, ...res });
      showToast('Action logged publicly at /modlog', 'success');
    } catch (err: any) {
      showToast(err.message || 'Moderation action blocked', 'error');
    }
  };

  const handleMuteCommunity = () => {
    setMenuOpen(false);
    if (!settings.mutedCommunities.includes(post.communityName)) {
      updateSettings({
        mutedCommunities: [...settings.mutedCommunities, post.communityName],
      });
    }
    if (!isDetail) onRemovedFromFeed?.(post.id);
    showToast(`Muted r/${post.communityName} locally`, 'info');
  };

  const handleBlockAuthor = () => {
    setMenuOpen(false);
    if (!settings.blockedUsers.includes(post.authorUsername)) {
      updateSettings({
        blockedUsers: [...settings.blockedUsers, post.authorUsername],
      });
    }
    if (!isDetail) onRemovedFromFeed?.(post.id);
    showToast(`Blocked u/${post.authorUsername} locally`, 'info');
  };

  const renderBadges = () => {
    const hasAny =
      post.isPinned || post.isLocked || post.isNsfw || post.isSpoiler || post.isOc || post.flair;
    if (!hasAny) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {post.isPinned && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#46D160]/15 px-2 py-0.5 text-[10px] font-bold text-[#46D160]">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}
        {post.isLocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eab308]/15 px-2 py-0.5 text-[10px] font-bold text-[#eab308]">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
        {post.isNsfw && (
          <span className="rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#ef4444]">
            NSFW
          </span>
        )}
        {post.isSpoiler && (
          <span className="rounded-full bg-[var(--or-pill)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--or-text-secondary)]">
            Spoiler
          </span>
        )}
        {post.isOc && (
          <span className="rounded-full bg-[#3b82f6]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#60a5fa]">
            OC
          </span>
        )}
        {post.flair && (
          <span
            style={{ backgroundColor: post.flair.bg, color: post.flair.color }}
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          >
            {post.flair.text}
          </span>
        )}
      </div>
    );
  };

  const renderAwards = () => {
    if (!post.awards || post.awards.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {post.awards.map((aw) => {
          const def = AWARD_MAP[aw.id];
          if (!def) return null;
          return (
            <span
              key={aw.id}
              title={`${def.name}: ${def.description}`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--or-border-subtle)] bg-[var(--or-pill)] px-2 py-0.5 text-[11px] font-semibold"
            >
              <span>{def.emoji}</span>
              <span className="text-[var(--or-text-secondary)] tabular-nums">{aw.count}</span>
            </span>
          );
        })}
      </div>
    );
  };

  const renderActionBar = () => (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--or-text-secondary)]">
      {/* Modern Reddit Vote Pill */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex h-8 items-center rounded-full ${
          post.userVote === 1
            ? 'bg-[#FF4500] text-white'
            : post.userVote === -1
              ? 'bg-[#6A5CFF] text-white'
              : 'bg-[var(--or-pill)] text-[var(--or-text)]'
        }`}
      >
        <button
          type="button"
          onClick={(e) => handleVote(1, e)}
          aria-label="Upvote"
          className="flex h-8 w-8 items-center justify-center rounded-l-full hover:bg-black/15"
        >
          <ArrowBigUp className={`h-[19px] w-[19px] ${post.userVote === 1 ? 'fill-white' : ''}`} />
        </button>
        <span className="min-w-[1.25rem] px-0.5 text-center text-xs font-bold tabular-nums">
          {formatCount(post.score)}
        </span>
        <button
          type="button"
          onClick={(e) => handleVote(-1, e)}
          aria-label="Downvote"
          className="flex h-8 w-8 items-center justify-center rounded-r-full hover:bg-black/15"
        >
          <ArrowBigDown className={`h-[19px] w-[19px] ${post.userVote === -1 ? 'fill-white' : ''}`} />
        </button>
      </div>

      {/* Comments Pill */}
      <Link
        to={detailUrl}
        onClick={(e) => e.stopPropagation()}
        className="or-pill-btn inline-flex h-8 items-center gap-1.5 rounded-full px-3 tabular-nums"
      >
        <MessageSquare className="h-4 w-4" />
        <span>{formatCount(post.commentCount)}</span>
      </Link>

      {/* Award Pill */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!user) openAuthModal('login');
          else
            setAwardTarget({
              type: 'post',
              id: post.id,
              onAwarded: (awards) => onUpdated?.({ ...post, awards }),
            });
        }}
        className="or-pill-btn inline-flex h-8 items-center gap-1.5 rounded-full px-3"
      >
        <Award className="h-4 w-4" />
        <span className="hidden sm:inline">Award</span>
      </button>

      {/* Share Pill */}
      <button
        type="button"
        onClick={handleShare}
        className="or-pill-btn inline-flex h-8 items-center gap-1.5 rounded-full px-3"
      >
        <Share2 className="h-4 w-4" />
        <span>Share</span>
      </button>

      {/* Crosspost Pill */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!user) openAuthModal('login');
          else setCrosspostTarget(post);
        }}
        className="or-pill-btn hidden h-8 items-center gap-1.5 rounded-full px-3 sm:inline-flex"
      >
        <Repeat2 className="h-4 w-4" />
        <span>Crosspost</span>
      </button>

      {/* Save Pill */}
      <button
        type="button"
        onClick={handleSave}
        className={`or-pill-btn hidden h-8 items-center gap-1.5 rounded-full px-3 md:inline-flex ${
          post.isSaved ? 'text-[#FF4500]' : ''
        }`}
      >
        <Bookmark className={`h-4 w-4 ${post.isSaved ? 'fill-[#FF4500]' : ''}`} />
        <span>{post.isSaved ? 'Saved' : 'Save'}</span>
      </button>
    </div>
  );

  // Compact & Classic Views
  if (!isDetail && (viewMode === 'compact' || viewMode === 'classic')) {
    const thumbUrl = post.media?.[0]?.url;
    return (
      <article
        onClick={() => navigate(detailUrl)}
        className="flex cursor-pointer items-center gap-3 border-b border-[var(--or-border-subtle)] px-3 py-2.5 transition-colors hover:bg-[var(--or-surface-elevated)]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex w-11 shrink-0 flex-col items-center justify-center"
        >
          <button
            type="button"
            onClick={(e) => handleVote(1, e)}
            className={`rounded p-0.5 hover:bg-[var(--or-pill)] ${
              post.userVote === 1 ? 'text-[#FF4500]' : 'text-[var(--or-text-secondary)]'
            }`}
          >
            <ArrowBigUp className={`h-5 w-5 ${post.userVote === 1 ? 'fill-[#FF4500]' : ''}`} />
          </button>
          <span
            className={`text-xs font-bold tabular-nums ${
              post.userVote === 1
                ? 'text-[#FF4500]'
                : post.userVote === -1
                  ? 'text-[#6A5CFF]'
                  : 'text-[var(--or-text)]'
            }`}
          >
            {formatCount(post.score)}
          </span>
          <button
            type="button"
            onClick={(e) => handleVote(-1, e)}
            className={`rounded p-0.5 hover:bg-[var(--or-pill)] ${
              post.userVote === -1 ? 'text-[#6A5CFF]' : 'text-[var(--or-text-secondary)]'
            }`}
          >
            <ArrowBigDown className={`h-5 w-5 ${post.userVote === -1 ? 'fill-[#6A5CFF]' : ''}`} />
          </button>
        </div>

        {viewMode === 'classic' && (
          <div className="hidden h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--or-border-subtle)] bg-[var(--or-surface-elevated)] sm:flex">
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt=""
                className={`h-full w-full object-cover ${isBlurred ? 'blur-md' : ''}`}
              />
            ) : post.url ? (
              <ExternalLink className="h-5 w-5 text-[var(--or-text-muted)]" />
            ) : (
              <MessageSquare className="h-5 w-5 text-[var(--or-text-muted)]" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link
              to={`/r/${post.communityName}`}
              onClick={(e) => e.stopPropagation()}
              className="font-bold hover:underline"
            >
              r/{post.communityName}
            </Link>
            <span className="text-[var(--or-text-muted)]">•</span>
            <Link
              to={`/u/${post.authorUsername}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--or-text-secondary)] hover:underline"
            >
              u/{post.authorUsername}
            </Link>
            <span className="text-[var(--or-text-muted)]">{timeAgo(post.createdAt)}</span>
            {renderBadges()}
          </div>

          <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
            <h3 className="text-[15px] font-semibold text-[var(--or-text)]">{post.title}</h3>
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-[#4fbcff] hover:underline"
              >
                ({extractDomain(post.url)})
              </a>
            )}
          </div>

          <div className="mt-1 flex items-center gap-4 text-[11px] font-semibold text-[var(--or-text-secondary)]">
            <span className="flex items-center gap-1 tabular-nums">
              <MessageSquare className="h-3.5 w-3.5" /> {post.commentCount} comments
            </span>
            <button type="button" onClick={handleSave} className="hover:text-[var(--or-text)]">
              {post.isSaved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={handleShare} className="hover:text-[var(--or-text)]">
              Share
            </button>
            {renderAwards()}
          </div>
        </div>
      </article>
    );
  }

  // Modern Reddit Seamless Card View & Detail View
  const totalPollVotes = post.pollData
    ? post.pollData.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;

  return (
    <div className={!isDetail ? 'border-b border-[var(--or-border-subtle)] py-1.5 last:border-0' : ''}>
      <article
        onClick={() => {
          if (!isDetail) navigate(detailUrl);
        }}
        className={`rounded-2xl px-4 py-3.5 transition-colors ${
          !isDetail
            ? 'cursor-pointer hover:bg-[var(--or-surface-elevated)]'
            : 'bg-[var(--or-surface)]'
        }`}
      >
        {post.isRemoved && (
          <div className="mb-3 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
            <strong>Transparency Notice:</strong> Marked removed by community moderators. Reason:
            &ldquo;{post.removedReason}&rdquo; — logged at{' '}
            <Link to="/modlog" onClick={(e) => e.stopPropagation()} className="underline font-semibold">
              /modlog
            </Link>
            .
          </div>
        )}

        {/* Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link
              to={`/r/${post.communityName}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 font-bold hover:underline"
            >
              <span
                style={{ backgroundColor: post.communityAccentColor }}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-white"
              >
                {post.communityIconEmoji}
              </span>
              <span>r/{post.communityName}</span>
            </Link>
            <span className="text-[var(--or-text-muted)]">•</span>
            <span className="text-[var(--or-text-secondary)]">{timeAgo(post.createdAt)}</span>
            {post.editedAt && (
              <span className="text-[11px] text-[var(--or-text-muted)] italic">(edited)</span>
            )}
            <span className="text-[var(--or-text-muted)]">•</span>
            <Link
              to={`/u/${post.authorUsername}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[var(--or-text-secondary)] hover:underline"
            >
              <UserAvatar
                username={post.authorUsername}
                color={post.authorAvatarColor}
                avatarUrl={post.authorAvatarUrl}
                size={18}
              />
              <span>u/{post.authorUsername}</span>
            </Link>
            {post.authorFlair && (
              <span className="rounded-full bg-[var(--or-pill)] px-2 py-0.5 text-[10px] font-semibold text-[var(--or-text-secondary)]">
                {post.authorFlair}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {renderAwards()}
            {!isDetail && !isJoinedCommunity && (
              <button
                type="button"
                onClick={() => toggleJoinCommunity(post.communityId, false)}
                className="or-btn-join h-6 rounded-full px-3 text-[11px] font-semibold"
              >
                Join
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--or-text-secondary)] hover:bg-[var(--or-pill)] hover:text-[var(--or-text)]"
                aria-label="More post actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-8 z-30 w-52 overflow-hidden rounded-xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] py-1 text-xs shadow-2xl">
                  <button
                    type="button"
                    onClick={(e) => {
                      setMenuOpen(false);
                      handleSave(e);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--or-surface-hover)]"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    {post.isSaved ? 'Unsave' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleHide}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--or-surface-hover)]"
                  >
                    {post.isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {post.isHidden ? 'Unhide post' : 'Hide post'}
                  </button>
                  <button
                    type="button"
                    onClick={handleMuteCommunity}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--or-surface-hover)]"
                  >
                    <VolumeX className="h-3.5 w-3.5" />
                    Mute r/{post.communityName}
                  </button>
                  {!isAuthor && (
                    <button
                      type="button"
                      onClick={handleBlockAuthor}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--or-surface-hover)]"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Block u/{post.authorUsername}
                    </button>
                  )}
                  {isAuthor && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setEditing(true);
                          if (!isDetail) navigate(detailUrl);
                        }}
                        className="flex w-full items-center gap-2.5 border-t border-[var(--or-border-subtle)] px-3 py-2 text-left hover:bg-[var(--or-surface-hover)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit post
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[#f87171] hover:bg-[var(--or-surface-hover)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete post
                      </button>
                    </>
                  )}
                  {canModerate && (
                    <div className="border-t border-[var(--or-border-subtle)] pt-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase text-[var(--or-text-muted)]">
                        Moderator
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMod(post.isPinned ? 'unpinPost' : 'pinPost')}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--or-surface-hover)]"
                      >
                        <Pin className="h-3.5 w-3.5" /> {post.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMod(post.isLocked ? 'unlockPost' : 'lockPost')}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--or-surface-hover)]"
                      >
                        <Lock className="h-3.5 w-3.5" /> {post.isLocked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMod('toggleNsfw')}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--or-surface-hover)]"
                      >
                        Toggle NSFW
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMod(post.isRemoved ? 'restorePost' : 'removePost')}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[#f87171] hover:bg-[var(--or-surface-hover)]"
                      >
                        {post.isRemoved ? 'Restore post' : 'Remove (public log)'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title & Flairs */}
        <div className="mt-1.5 space-y-1.5">
          <h2
            className={`font-semibold tracking-[-0.01em] leading-[1.32] text-[var(--or-text)] ${
              isDetail ? 'text-[22px] sm:text-2xl font-bold' : 'text-[17px] sm:text-[18px]'
            }`}
          >
            {post.title}
          </h2>
          {renderBadges()}
        </div>

        {/* Content */}
        <div className="relative mt-2.5">
          <div className={isBlurred ? 'pointer-events-none select-none blur-xl opacity-40' : ''}>
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--or-border)] bg-[var(--or-panel-bg)] px-3.5 py-2.5 hover:border-[#4fbcff]"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#4fbcff]">{extractDomain(post.url)}</div>
                  <div className="truncate text-xs text-[var(--or-text-secondary)]">{post.url}</div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-[#4fbcff]" />
              </a>
            )}

            {post.crosspost && (
              <Link
                to={`/r/${post.crosspost.communityName}/comments/${post.crosspost.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mb-3 block rounded-xl border border-[var(--or-border)] bg-[var(--or-panel-bg)] p-3 hover:border-[var(--or-text-secondary)]"
              >
                <div className="flex items-center gap-1.5 text-xs text-[var(--or-text-secondary)]">
                  <Repeat2 className="h-3.5 w-3.5 text-[#4fbcff]" />
                  <span>{post.crosspost.communityIconEmoji}</span>
                  <span className="font-bold text-[var(--or-text)]">
                    r/{post.crosspost.communityName}
                  </span>
                  <span>• u/{post.crosspost.authorUsername}</span>
                  <span>• {timeAgo(post.crosspost.createdAt)}</span>
                </div>
                <div className="mt-1 font-semibold text-sm">{post.crosspost.title}</div>
                {post.crosspost.media?.[0]?.url && (
                  <img
                    src={post.crosspost.media[0].url}
                    alt={post.crosspost.title}
                    className="mt-2 max-h-64 w-full rounded-lg object-cover border border-[var(--or-border-subtle)]"
                  />
                )}
                <div className="mt-2 text-xs text-[var(--or-text-muted)] tabular-nums">
                  {formatCount(post.crosspost.score)} upvotes • {post.crosspost.commentCount} comments
                </div>
              </Link>
            )}

            {post.postType === 'video' && post.media?.[0]?.url && (
              <div className="mb-3 overflow-hidden rounded-2xl border border-[var(--or-border-subtle)] bg-black">
                <video
                  src={post.media[0].url}
                  controls
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[500px] w-full"
                />
              </div>
            )}

            {post.postType !== 'video' && post.media && post.media.length > 0 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox({ images: post.media, index: galleryIdx });
                }}
                className="relative mb-3 overflow-hidden rounded-2xl border border-[var(--or-border-subtle)] bg-[#050708]"
              >
                <img
                  src={post.media[Math.min(galleryIdx, post.media.length - 1)].url}
                  alt={post.media[galleryIdx]?.caption || post.title}
                  className="mx-auto max-h-[520px] w-full object-contain"
                />
                {post.media.length > 1 && (
                  <>
                    <div className="absolute right-3 top-3 rounded-full bg-black/75 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
                      {galleryIdx + 1} / {post.media.length}
                    </div>
                    {galleryIdx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGalleryIdx((i) => Math.max(0, i - 1));
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    )}
                    {galleryIdx < post.media.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGalleryIdx((i) => Math.min(post.media.length - 1, i + 1));
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    )}
                  </>
                )}
                {post.media[galleryIdx]?.caption && (
                  <div className="border-t border-[var(--or-border-subtle)] bg-[var(--or-panel-bg)] px-3 py-1.5 text-xs text-[var(--or-text-secondary)]">
                    {post.media[galleryIdx].caption}
                  </div>
                )}
              </div>
            )}

            {post.pollData && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mb-3 rounded-2xl border border-[var(--or-border)] bg-[var(--or-panel-bg)] p-3.5"
              >
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--or-text-secondary)]">
                  <span className="font-bold text-[var(--or-text)]">Poll</span>
                  <span className="tabular-nums">{formatCount(totalPollVotes)} votes</span>
                </div>
                <div className="space-y-2">
                  {post.pollData.options.map((opt) => {
                    const pct =
                      totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                    const isChosen = post.userPollVote === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={(e) => handlePollVote(opt.id, e)}
                        className={`relative flex w-full items-center justify-between overflow-hidden rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          isChosen
                            ? 'border-[#FF4500] text-[var(--or-text)]'
                            : 'border-[var(--or-border)] text-[var(--or-text)] hover:border-[var(--or-text-secondary)]'
                        }`}
                      >
                        <span
                          style={{ width: `${pct}%` }}
                          className={`absolute inset-y-0 left-0 transition-all ${
                            isChosen ? 'bg-[#FF4500]/20' : 'bg-[var(--or-pill)]'
                          }`}
                        />
                        <span className="relative z-10 flex items-center gap-2">
                          {isChosen && <span className="text-[#FF4500]">✓</span>}
                          {opt.text}
                        </span>
                        <span className="relative z-10 shrink-0 text-[var(--or-text-secondary)] tabular-nums">
                          {pct}% ({formatCount(opt.votes)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {editing ? (
              <div onClick={(e) => e.stopPropagation()} className="space-y-2">
                <MarkdownEditor value={editBody} onChange={setEditBody} rows={6} />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-[var(--or-surface-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={handleSaveEdit}
                    className="rounded-full bg-[#FF4500] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#d93900]"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              post.body && (
                <div
                  className={
                    !isDetail && post.postType === 'text'
                      ? 'max-h-44 overflow-hidden text-[var(--or-text-secondary)]'
                      : 'text-[var(--or-text)]'
                  }
                >
                  <MarkdownBody content={post.body} />
                </div>
              )
            )}
          </div>

          {isBlurred && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/45 p-4 text-center backdrop-blur-sm">
              <span className="rounded-full bg-[#ef4444] px-3 py-1 text-xs font-bold uppercase text-white">
                {post.isNsfw ? 'NSFW Content' : 'Spoiler Warning'}
              </span>
              <p className="mt-2 text-xs text-white/90">Blurred by your local filter settings</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRevealedBlur(true);
                }}
                className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-white/90"
              >
                Click to reveal
              </button>
            </div>
          )}
        </div>

        {renderActionBar()}
      </article>
    </div>
  );
}
