import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { CommentItem, CommentSort, Community, CommunityModerator, Post } from '../types';
import { CommentThread } from '../components/CommentThread';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { PostCard } from '../components/PostCard';
import { RightSidebar } from '../components/RightSidebar';

export function PostDetailPage() {
  const { name = '', postId = '' } = useParams();
  const { user, openAuthModal, recordRecentCommunity, recordRecentPost, showToast } = useApp();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [moderators, setModerators] = useState<CommunityModerator[]>([]);
  const [commentSort, setCommentSort] = useState<CommentSort>('best');
  const [commentSearch, setCommentSearch] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, commRes] = await Promise.all([
        api.getPostDetail(postId, commentSort),
        api.getCommunity(name).catch(() => null),
      ]);
      setPost(detail.post);
      setComments(detail.comments);
      recordRecentPost(detail.post);
      if (commRes) {
        setCommunity(commRes.community);
        setModerators(commRes.moderators);
        recordRecentCommunity(commRes.community.name);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not load post', 'error');
    } finally {
      setLoading(false);
    }
  }, [postId, name, commentSort, recordRecentCommunity, recordRecentPost, showToast]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const canModerate = Boolean(
    community && (community.role === 'owner' || community.role === 'mod' || user?.isAdmin)
  );

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!post || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.createComment(post.id, newComment.trim(), null);
      setComments((prev) => [res.comment, ...prev]);
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      setNewComment('');
      showToast('Comment posted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to post comment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] gap-6 px-3 py-4 sm:px-5">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/r/${name}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--or-surface)] px-3 py-1.5 text-xs font-bold border border-[var(--or-border)] hover:bg-[var(--or-surface-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to r/{name}
          </Link>
        </div>

        {loading || !post ? (
          <div className="h-64 animate-pulse rounded-2xl border border-[var(--or-border-subtle)] bg-[var(--or-surface)]" />
        ) : (
          <>
            <PostCard
              post={post}
              isDetail
              canModerate={canModerate}
              onUpdated={setPost}
            />

            {/* Comment Composer */}
            <div className="rounded-2xl border border-[var(--or-border-subtle)] bg-[var(--or-surface)] p-4">
              {post.isLocked ? (
                <div className="flex items-center gap-2 rounded-xl bg-[#eab308]/10 px-4 py-3 text-xs font-semibold text-[#eab308]">
                  <Lock className="h-4 w-4" />
                  Comments are locked by community moderators.
                </div>
              ) : (
                <form onSubmit={handleSubmitComment} className="space-y-2.5">
                  <div className="text-xs font-semibold text-[var(--or-text-secondary)]">
                    {user ? (
                      <>
                        Comment as <strong className="text-[var(--or-text)]">u/{user.username}</strong>
                      </>
                    ) : (
                      'Join the discussion — log in or sign up (no email required) to reply'
                    )}
                  </div>
                  <MarkdownEditor
                    value={newComment}
                    onChange={setNewComment}
                    placeholder="What are your thoughts? Supports Markdown, code blocks, quotes, and >!spoilers!<"
                    rows={4}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting || (Boolean(user) && !newComment.trim())}
                      className="rounded-full bg-[#FF4500] px-5 py-2 text-xs font-bold text-white hover:bg-[#ff5414] disabled:opacity-50"
                    >
                      {user ? (submitting ? 'Commenting...' : 'Comment') : 'Log In to Comment'}
                    </button>
                  </div>
                </form>
              )}

              {/* Sort & Comment Search Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--or-border-subtle)] pt-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[var(--or-text-secondary)]">Sort by:</span>
                  <select
                    value={commentSort}
                    onChange={(e) => setCommentSort(e.target.value as CommentSort)}
                    className="or-input rounded-full px-3 py-1 text-xs font-bold"
                  >
                    <option value="best">Best</option>
                    <option value="top">Top</option>
                    <option value="new">New</option>
                    <option value="controversial">Controversial</option>
                    <option value="old">Old</option>
                    <option value="qa">Q&amp;A (OP first)</option>
                  </select>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--or-text-muted)]" />
                  <input
                    type="text"
                    value={commentSearch}
                    onChange={(e) => setCommentSearch(e.target.value)}
                    placeholder="Search comments..."
                    className="or-input w-full rounded-full py-1.5 pl-8 pr-3 text-xs"
                  />
                </div>
              </div>

              {/* Nested Threaded Comments */}
              <div className="mt-3">
                <CommentThread
                  comments={comments}
                  postAuthorId={post.authorId}
                  isLocked={post.isLocked}
                  canModerate={canModerate}
                  searchQuery={commentSearch}
                  onCommentAdded={(c) => {
                    setComments((prev) => [...prev, c]);
                    setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
                  }}
                  onCommentUpdated={(updated) =>
                    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>

      <RightSidebar
        community={community}
        moderators={moderators}
        onCommunityUpdated={setCommunity}
      />
    </div>
  );
}
