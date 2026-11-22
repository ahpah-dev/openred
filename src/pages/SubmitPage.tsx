import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart2,
  FileText,
  Image as ImageIcon,
  Link2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, compressImageToDataUrl } from '../services/api';
import type { PostFlair, PostMediaItem } from '../types';
import { MarkdownEditor } from '../components/MarkdownEditor';

export function SubmitPage() {
  const [searchParams] = useSearchParams();
  const initialComm = searchParams.get('r') || '';
  const {
    user,
    allCommunities,
    drafts,
    saveDraft,
    deleteDraft,
    openAuthModal,
    setCreateCommunityOpen,
    showToast,
  } = useApp();
  const navigate = useNavigate();

  const [communityName, setCommunityName] = useState(initialComm);
  const [postType, setPostType] = useState<'text' | 'image' | 'link' | 'poll'>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [media, setMedia] = useState<PostMediaItem[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDays, setPollDays] = useState(7);
  const [selectedFlair, setSelectedFlair] = useState<PostFlair | null>(null);
  const [isOc, setIsOc] = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

  const selectedComm = useMemo(
    () =>
      allCommunities.find((c) => c.name.toLowerCase() === communityName.toLowerCase()) ||
      allCommunities[0],
    [allCommunities, communityName]
  );

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const nextItems: PostMediaItem[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      if (f.type.startsWith('image/')) {
        try {
          const dataUrl = await compressImageToDataUrl(f, 1280, 0.82);
          nextItems.push({ url: dataUrl, caption: f.name });
        } catch {
          showToast(`Failed to process ${f.name}`, 'error');
        }
      }
    }
    setMedia((prev) => [...prev, ...nextItems].slice(0, 8));
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setMedia((prev) => [...prev, { url: imageUrlInput.trim(), caption: '' }].slice(0, 8));
    setImageUrlInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!selectedComm?.name && !communityName.trim()) {
      showToast('Create or select a community first', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('Please enter a post title', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const effectiveType =
        postType === 'image' && media.length > 1 ? 'gallery' : postType;
      const res = await api.createPost({
        communityName: selectedComm?.name || communityName,
        title: title.trim(),
        postType: effectiveType,
        body,
        url: postType === 'link' ? url.trim() : undefined,
        media: postType === 'image' ? media : undefined,
        pollOptions: postType === 'poll' ? pollOptions.filter((o) => o.trim()) : undefined,
        pollDays: postType === 'poll' ? pollDays : undefined,
        flair: selectedFlair,
        isNsfw,
        isSpoiler,
        isOc,
      });
      showToast('Post published!', 'success');
      navigate(`/r/${res.post.communityName}/comments/${res.post.id}`);
    } catch (err: any) {
      showToast(err.message || 'Could not publish post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Create a Post</h1>
        <button
          type="button"
          onClick={() => setShowDrafts((v) => !v)}
          className="rounded-full border border-[var(--or-border)] px-3.5 py-1.5 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
        >
          Drafts ({drafts.length})
        </button>
      </div>

      {showDrafts && (
        <div className="mt-3 rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-4">
          <div className="mb-2 text-xs font-bold uppercase text-[var(--or-text-muted)]">
            Saved Local Drafts
          </div>
          {drafts.length === 0 ? (
            <p className="text-xs text-[var(--or-text-secondary)]">No saved drafts.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--or-border-subtle)] bg-[var(--or-surface-elevated)] px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCommunityName(d.communityName);
                      setTitle(d.title);
                      setBody(d.body);
                      setUrl(d.url);
                      setShowDrafts(false);
                    }}
                    className="flex-1 text-left font-semibold hover:text-[#FF4500]"
                  >
                    r/{d.communityName}: {d.title || '(Untitled draft)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDraft(d.id)}
                    className="p-1 text-[#ef4444]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Community Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {allCommunities.length === 0 ? (
            <div className="or-panel flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <div className="text-xs text-[var(--or-text-secondary)]">
                <strong className="text-sm text-[var(--or-text)] block">No communities exist yet</strong>
                Create the first community on OpenRed before publishing your post.
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!user) openAuthModal('register');
                  else setCreateCommunityOpen(true);
                }}
                className="or-btn-join inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
              >
                <Plus className="h-4 w-4" /> Create a Community
              </button>
            </div>
          ) : (
            <>
              <select
                value={selectedComm?.name || communityName}
                onChange={(e) => {
                  setCommunityName(e.target.value);
                  setSelectedFlair(null);
                }}
                className="or-input rounded-2xl px-4 py-2.5 text-sm font-semibold"
              >
                {allCommunities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.iconEmoji} r/{c.name}
                  </option>
                ))}
              </select>
              {selectedComm?.isUnmoderated && (
                <span className="rounded-full bg-[#f59e0b]/15 px-3 py-1 text-xs font-bold text-[#f59e0b]">
                  Zero-Moderation Free-Speech Zone
                </span>
              )}
            </>
          )}
        </div>

        {/* Post Type Tabs */}
        <div className="overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)]">
          <div className="grid grid-cols-4 border-b border-[var(--or-border)] text-xs font-bold">
            {(
              [
                { id: 'text', label: 'Text', icon: <FileText className="h-4 w-4" /> },
                { id: 'image', label: 'Images', icon: <ImageIcon className="h-4 w-4" /> },
                { id: 'link', label: 'Link', icon: <Link2 className="h-4 w-4" /> },
                { id: 'poll', label: 'Poll', icon: <BarChart2 className="h-4 w-4" /> },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPostType(tab.id)}
                className={`flex items-center justify-center gap-2 border-b-2 py-3 transition-colors ${
                  postType === tab.id
                    ? 'border-[#FF4500] bg-[var(--or-surface-elevated)] text-[var(--or-text)]'
                    : 'border-transparent text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4 p-4">
            {/* Title */}
            <div>
              <input
                type="text"
                required
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title*"
                className="or-input w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
              />
              <div className="mt-1 text-right text-[11px] text-[var(--or-text-muted)]">
                {title.length} / 300
              </div>
            </div>

            {/* Image / Gallery Tab */}
            {postType === 'image' && (
              <div className="space-y-3">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-6 text-center hover:border-[#FF4500]">
                  <Upload className="h-7 w-7 text-[var(--or-text-secondary)]" />
                  <span className="mt-2 text-xs font-bold">
                    Drop images here or click to upload (supports multi-image Gallery)
                  </span>
                  <span className="mt-0.5 text-[11px] text-[var(--or-text-muted)]">
                    Automatically compressed client-side for fast posting
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    className="hidden"
                  />
                </label>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or paste an image URL..."
                    className="or-input flex-1 rounded-xl px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="rounded-xl bg-[var(--or-pill)] px-4 py-2 text-xs font-bold"
                  >
                    Add URL
                  </button>
                </div>

                {media.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {media.map((m, idx) => (
                      <div
                        key={idx}
                        className="relative overflow-hidden rounded-xl border border-[var(--or-border)] bg-black"
                      >
                        <img src={m.url} alt="" className="h-32 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute right-1.5 top-1.5 rounded-full bg-black/80 p-1 text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="text"
                          value={m.caption || ''}
                          onChange={(e) =>
                            setMedia((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, caption: e.target.value } : it))
                            )
                          }
                          placeholder="Caption (optional)"
                          className="w-full bg-[var(--or-surface-elevated)] px-2 py-1 text-[11px] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Link Tab */}
            {postType === 'link' && (
              <div>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="or-input w-full rounded-xl px-4 py-2.5 text-sm"
                />
              </div>
            )}

            {/* Poll Tab */}
            {postType === 'poll' && (
              <div className="space-y-2.5 rounded-xl border border-[var(--or-border)] bg-[var(--or-surface-elevated)] p-3.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Poll Options (2–6)</span>
                  <select
                    value={pollDays}
                    onChange={(e) => setPollDays(Number(e.target.value))}
                    className="or-input rounded-lg px-2 py-1 text-xs"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                  </select>
                </div>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) =>
                        setPollOptions((prev) =>
                          prev.map((o, i) => (i === idx ? e.target.value : o))
                        )
                      }
                      placeholder={`Option ${idx + 1}`}
                      className="or-input flex-1 rounded-xl px-3 py-2 text-xs"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPollOptions((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-[var(--or-text-muted)] hover:text-[#ef4444]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => [...prev, ''])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#4fbcff] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Option
                  </button>
                )}
              </div>
            )}

            {/* Body Markdown Editor */}
            <MarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Body text (optional for links/images, supports Markdown & >!spoilers!<)"
              rows={6}
            />

            {/* Flairs & Tags */}
            <div className="space-y-3 border-t border-[var(--or-border-subtle)] pt-3">
              {selectedComm && selectedComm.postFlairs.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-bold text-[var(--or-text-secondary)]">
                    Post Flair
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedComm.postFlairs.map((pf) => {
                      const active = selectedFlair?.text === pf.text;
                      return (
                        <button
                          key={pf.text}
                          type="button"
                          onClick={() => setSelectedFlair(active ? null : pf)}
                          style={{
                            backgroundColor: active ? pf.bg : undefined,
                            color: active ? pf.color : undefined,
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            active
                              ? 'ring-2 ring-white/40'
                              : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)]'
                          }`}
                        >
                          {pf.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {[
                  { label: '+ OC', active: isOc, toggle: () => setIsOc((v) => !v) },
                  { label: '+ Spoiler', active: isSpoiler, toggle: () => setIsSpoiler((v) => !v) },
                  { label: '+ NSFW', active: isNsfw, toggle: () => setIsNsfw((v) => !v) },
                ].map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={tag.toggle}
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${
                      tag.active
                        ? 'border-[#FF4500] bg-[#FF4500]/15 text-[#FF4500]'
                        : 'border-[var(--or-border)] text-[var(--or-text-secondary)]'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--or-border-subtle)] pt-3">
              <button
                type="button"
                onClick={() =>
                  saveDraft({
                    communityName: selectedComm?.name || communityName,
                    postType,
                    title,
                    body,
                    url,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--or-border)] px-4 py-2 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
              >
                <Save className="h-3.5 w-3.5" /> Save Draft
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[#FF4500] px-6 py-2 text-xs font-bold text-white hover:bg-[#ff5414] disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
