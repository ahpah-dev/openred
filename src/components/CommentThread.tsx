import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowBigDown,
  ArrowBigUp,
  Award,
  Bookmark,
  MessageSquare,
  Pencil,
  Pin,
  Shield,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { CommentItem } from '../types';
import { AWARD_MAP, formatCount, timeAgo } from '../utils/format';
import { MarkdownBody } from '../utils/markdown';
import { UserAvatar } from './Avatar';
import { MarkdownEditor } from './MarkdownEditor';

interface CommentNode extends CommentItem {
  children: CommentNode[];
}

interface CommentThreadProps {
  comments: CommentItem[];
  postAuthorId: string;
  isLocked: boolean;
  canModerate: boolean;
  searchQuery?: string;
  onCommentAdded: (c: CommentItem) => void;
  onCommentUpdated: (c: CommentItem) => void;
}

function countSubtree(node: CommentNode): number {
  return 1 + node.children.reduce((acc, ch) => acc + countSubtree(ch), 0);
}

function CommentBranch({
  node,
  depth,
  postAuthorId,
  isLocked,
  canModerate,
  searchQuery,
  onCommentAdded,
  onCommentUpdated,
}: {
  node: CommentNode;
  depth: number;
  postAuthorId: string;
  isLocked: boolean;
  canModerate: boolean;
  searchQuery: string;
  onCommentAdded: (c: CommentItem) => void;
  onCommentUpdated: (c: CommentItem) => void;
}) {
  const { user, openAuthModal, setAwardTarget, showToast } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(node.body);

  const isAuthor = Boolean(user && user.id === node.authorId);
  const isOp = node.authorId === postAuthorId && !node.isDeleted;
  const matchesQuery =
    searchQuery.trim() &&
    (node.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.authorUsername.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleVote = async (dir: 1 | -1) => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    const nextVal = node.userVote === dir ? 0 : dir;
    const delta = nextVal - node.userVote;
    onCommentUpdated({ ...node, userVote: nextVal, score: node.score + delta });
    try {
      const res = await api.vote('comment', node.id, nextVal as 1 | -1 | 0);
      onCommentUpdated({
        ...node,
        upvotes: res.upvotes,
        downvotes: res.downvotes,
        score: res.score,
        userVote: res.userVote,
      });
    } catch (err: any) {
      onCommentUpdated(node);
      showToast(err.message || 'Vote failed', 'error');
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await api.createComment(node.postId, replyText.trim(), node.id);
      onCommentAdded(res.comment);
      setReplyText('');
      setReplyOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to reply', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleEditSave = async () => {
    if (!editBody.trim()) return;
    try {
      const res = await api.editComment(node.id, editBody.trim());
      onCommentUpdated({ ...node, body: res.body, editedAt: res.editedAt });
      setEditing(false);
      showToast('Comment updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Edit failed', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.deleteComment(node.id);
      onCommentUpdated({
        ...node,
        isDeleted: true,
        authorUsername: '[deleted]',
        body: '[deleted]',
      });
      showToast('Comment deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleSave = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    try {
      const res = await api.toggleSaveComment(node.id, !node.isSaved);
      onCommentUpdated({ ...node, isSaved: res.isSaved });
      showToast(res.isSaved ? 'Comment saved' : 'Unsaved comment', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to save comment', 'error');
    }
  };

  const handleMod = async (action: string) => {
    try {
      const res = await api.modAction({ action, commentId: node.id });
      onCommentUpdated({ ...node, ...res });
      showToast('Comment moderation updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Moderation failed', 'error');
    }
  };

  const totalDescendants = countSubtree(node) - 1;

  return (
    <div className={`${depth > 0 ? 'mt-2.5' : 'border-b border-[var(--or-border-subtle)] py-3 last:border-0'}`}>
      <div
        className={`rounded-xl px-1.5 py-1 ${
          matchesQuery ? 'bg-[#FF4500]/10 ring-1 ring-[#FF4500]/40' : ''
        }`}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand thread' : 'Collapse thread'}
            className="flex items-center gap-1.5 hover:opacity-80"
          >
            <UserAvatar
              username={node.authorUsername}
              color={node.authorAvatarColor}
              avatarUrl={node.authorAvatarUrl}
              size={22}
            />
          </button>

          {node.isDeleted ? (
            <span className="font-bold text-[var(--or-text-muted)]">[deleted]</span>
          ) : (
            <Link to={`/u/${node.authorUsername}`} className="font-bold hover:underline">
              u/{node.authorUsername}
            </Link>
          )}

          {isOp && (
            <span className="rounded bg-[#3b82f6]/20 px-1.5 py-0.5 text-[10px] font-extrabold text-[#60a5fa]">
              OP
            </span>
          )}
          {node.isModDistinguished && (
            <span className="inline-flex items-center gap-0.5 rounded bg-[#46D160]/20 px-1.5 py-0.5 text-[10px] font-extrabold text-[#46D160]">
              <Shield className="h-2.5 w-2.5" /> MOD
            </span>
          )}
          {node.isPinned && (
            <span className="inline-flex items-center gap-0.5 rounded bg-[#46D160]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#46D160]">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </span>
          )}
          {node.authorFlair && !node.isDeleted && (
            <span className="rounded bg-[var(--or-pill)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--or-text-secondary)]">
              {node.authorFlair}
            </span>
          )}

          <span className="text-[var(--or-text-muted)]">• {timeAgo(node.createdAt)}</span>
          {node.editedAt && (
            <span className="text-[11px] text-[var(--or-text-muted)] italic">(edited)</span>
          )}

          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="ml-1 rounded-full bg-[var(--or-pill)] px-2 py-0.5 text-[11px] font-bold text-[#4fbcff]"
            >
              [+ {totalDescendants + 1} hidden]
            </button>
          )}

          {node.awards &&
            node.awards.map((aw) => {
              const def = AWARD_MAP[aw.id];
              return def ? (
                <span key={aw.id} className="text-xs" title={def.name}>
                  {def.emoji} {aw.count > 1 ? aw.count : ''}
                </span>
              ) : null;
            })}
        </div>

        {/* Body + Threadline */}
        {!collapsed && (
          <div className="mt-1 flex">
            {/* Clickable Reddit Thread Collapse Bar */}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse comment thread"
              className="group mr-2.5 flex w-4 shrink-0 justify-center py-1"
            >
              <span className="h-full w-0.5 rounded-full bg-[var(--or-border)] transition-colors group-hover:bg-[#FF4500]" />
            </button>

            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="my-2 space-y-2">
                  <MarkdownEditor value={editBody} onChange={setEditBody} rows={3} minHeight="80px" />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-full px-3 py-1 text-xs font-semibold hover:bg-[var(--or-surface-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleEditSave}
                      className="rounded-full bg-[#FF4500] px-3 py-1 text-xs font-bold text-white"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className={node.isDeleted ? 'text-xs italic text-[var(--or-text-muted)]' : ''}>
                  <MarkdownBody content={node.body} />
                </div>
              )}

              {/* Actions */}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--or-text-secondary)]">
                <div className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => handleVote(1)}
                    className={`rounded-full p-1 hover:bg-[var(--or-pill)] ${
                      node.userVote === 1 ? 'text-[#FF4500]' : ''
                    }`}
                  >
                    <ArrowBigUp className={`h-4 w-4 ${node.userVote === 1 ? 'fill-[#FF4500]' : ''}`} />
                  </button>
                  <span
                    className={`min-w-[1.25rem] text-center text-xs font-bold ${
                      node.userVote === 1
                        ? 'text-[#FF4500]'
                        : node.userVote === -1
                          ? 'text-[#7193FF]'
                          : ''
                    }`}
                  >
                    {formatCount(node.score)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleVote(-1)}
                    className={`rounded-full p-1 hover:bg-[var(--or-pill)] ${
                      node.userVote === -1 ? 'text-[#7193FF]' : ''
                    }`}
                  >
                    <ArrowBigDown className={`h-4 w-4 ${node.userVote === -1 ? 'fill-[#7193FF]' : ''}`} />
                  </button>
                </div>

                {!isLocked && !node.isDeleted && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) openAuthModal('login');
                      else setReplyOpen((v) => !v);
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Reply
                  </button>
                )}

                {!node.isDeleted && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) openAuthModal('login');
                      else
                        setAwardTarget({
                          type: 'comment',
                          id: node.id,
                          onAwarded: (awards) => onCommentUpdated({ ...node, awards }),
                        });
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
                  >
                    <Award className="h-3.5 w-3.5" /> Award
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--or-surface-hover)] ${
                    node.isSaved ? 'text-[#FF4500]' : ''
                  }`}
                >
                  <Bookmark className={`h-3.5 w-3.5 ${node.isSaved ? 'fill-[#FF4500]' : ''}`} />
                  {node.isSaved ? 'Saved' : 'Save'}
                </button>

                {isAuthor && !node.isDeleted && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--or-surface-hover)]"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[#ef4444] hover:bg-[var(--or-surface-hover)]"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </>
                )}

                {canModerate && !node.isDeleted && (
                  <>
                    {depth === 0 && (
                      <button
                        type="button"
                        onClick={() => handleMod(node.isPinned ? 'unpinComment' : 'pinComment')}
                        className="rounded-full px-2 py-1 text-[#46D160] hover:bg-[var(--or-surface-hover)]"
                      >
                        {node.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMod('distinguishComment')}
                      className="rounded-full px-2 py-1 text-[#46D160] hover:bg-[var(--or-surface-hover)]"
                    >
                      {node.isModDistinguished ? 'Undistinguish' : 'Mod Badge'}
                    </button>
                  </>
                )}
              </div>

              {/* Inline Reply Composer */}
              {replyOpen && (
                <div className="mt-2.5 space-y-2">
                  <MarkdownEditor
                    value={replyText}
                    onChange={setReplyText}
                    placeholder={`Reply to u/${node.authorUsername}...`}
                    rows={3}
                    minHeight="80px"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReplyOpen(false)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-[var(--or-surface-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submittingReply || !replyText.trim()}
                      onClick={handleReplySubmit}
                      className="rounded-full bg-[#FF4500] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#ff5414] disabled:opacity-50"
                    >
                      {submittingReply ? 'Replying...' : 'Reply'}
                    </button>
                  </div>
                </div>
              )}

              {/* Child comments */}
              {node.children.length > 0 && (
                <div>
                  {node.children.map((ch) => (
                    <CommentBranch
                      key={ch.id}
                      node={ch}
                      depth={depth + 1}
                      postAuthorId={postAuthorId}
                      isLocked={isLocked}
                      canModerate={canModerate}
                      searchQuery={searchQuery}
                      onCommentAdded={onCommentAdded}
                      onCommentUpdated={onCommentUpdated}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread({
  comments,
  postAuthorId,
  isLocked,
  canModerate,
  searchQuery = '',
  onCommentAdded,
  onCommentUpdated,
}: CommentThreadProps) {
  const tree = useMemo(() => {
    const map = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];
    for (const c of comments) {
      map.set(c.id, { ...c, children: [] });
    }
    for (const c of comments) {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }, [comments]);

  if (tree.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-[var(--or-text-secondary)]">
        No comments yet. Start the discussion!
      </div>
    );
  }

  return (
    <div>
      {tree.map((root) => (
        <CommentBranch
          key={root.id}
          node={root}
          depth={0}
          postAuthorId={postAuthorId}
          isLocked={isLocked}
          canModerate={canModerate}
          searchQuery={searchQuery}
          onCommentAdded={onCommentAdded}
          onCommentUpdated={onCommentUpdated}
        />
      ))}
    </div>
  );
}
