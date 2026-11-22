import React, { useEffect, useState } from 'react';
import { Download, Plus, Shield, Upload, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, compressImageToDataUrl } from '../services/api';
import type { ViewMode } from '../types';
import { UserAvatar } from '../components/Avatar';

export function SettingsPage() {
  const { user, settings, updateSettings, refreshSession, showToast } = useApp();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#FF4500');
  const [bannerColor, setBannerColor] = useState(user?.bannerColor || '#1A282D');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio);
      setAvatarColor(user.avatarColor);
      setBannerColor(user.bannerColor);
      setAvatarUrl(user.avatarUrl);
    }
  }, [user]);

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, 360, 0.85);
      setAvatarUrl(dataUrl);
    } catch {
      showToast('Could not read avatar file', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await api.updateProfile({
        displayName,
        bio,
        avatarColor,
        bannerColor,
        avatarUrl,
      });
      await refreshSession();
      showToast('Profile saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    if (!settings.mutedKeywords.includes(kw)) {
      updateSettings({ mutedKeywords: [...settings.mutedKeywords, kw] });
    }
    setKeywordInput('');
  };

  const handleExport = async () => {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openred-${user?.username || 'export'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Account data exported', 'success');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Settings &amp; Personal Content Controls</h1>

      {/* Profile Settings */}
      {user && (
        <form
          onSubmit={handleSaveProfile}
          className="space-y-4 rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-5"
        >
          <h2 className="text-base font-bold">Profile (u/{user.username})</h2>

          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              username={user.username}
              color={avatarColor}
              avatarUrl={avatarUrl}
              size={64}
            />
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--or-border)] px-3.5 py-1.5 text-xs font-bold hover:bg-[var(--or-surface-hover)]">
                <Upload className="h-3.5 w-3.5" /> Upload Avatar
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#ef4444]"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="or-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Avatar Color</label>
                <input
                  type="color"
                  value={avatarColor}
                  onChange={(e) => setAvatarColor(e.target.value)}
                  className="h-9 w-14 rounded border border-[var(--or-border)] bg-transparent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Banner Color</label>
                <input
                  type="color"
                  value={bannerColor}
                  onChange={(e) => setBannerColor(e.target.value)}
                  className="h-9 w-14 rounded border border-[var(--or-border)] bg-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold">Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="or-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-full bg-[#FF4500] px-5 py-2 text-xs font-bold text-white hover:bg-[#ff5414]"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Appearance */}
      <div className="space-y-4 rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-5">
        <h2 className="text-base font-bold">Appearance &amp; Feed Layout</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Theme</div>
            <div className="text-xs text-[var(--or-text-secondary)]">Switch between Dark and Light mode</div>
          </div>
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => updateSettings({ theme: th })}
                className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${
                  settings.theme === th
                    ? 'bg-[#FF4500] text-white'
                    : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)]'
                }`}
              >
                {th}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Default View Mode</div>
            <div className="text-xs text-[var(--or-text-secondary)]">Card, high-density Compact, or Old-Reddit Classic</div>
          </div>
          <div className="flex gap-1.5">
            {(['card', 'compact', 'classic'] as ViewMode[]).map((vm) => (
              <button
                key={vm}
                type="button"
                onClick={() => updateSettings({ viewMode: vm })}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize ${
                  settings.viewMode === vm
                    ? 'bg-[#FF4500] text-white'
                    : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)]'
                }`}
              >
                {vm}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Free-Speech Client-Side Content Controls */}
      <div className="space-y-4 rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-5">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#46D160]" />
          <h2 className="text-base font-bold">Client-Side Free-Speech Filters</h2>
        </div>
        <p className="text-xs text-[var(--or-text-secondary)]">
          Instead of central censorship, OpenRed lets you control exactly what appears in your personal feed.
        </p>

        <label className="flex items-center justify-between cursor-pointer py-1">
          <div>
            <div className="text-sm font-semibold">Show NSFW (18+) posts</div>
            <div className="text-xs text-[var(--or-text-secondary)]">Include mature discussions in feeds</div>
          </div>
          <input
            type="checkbox"
            checked={settings.showNsfw}
            onChange={(e) => updateSettings({ showNsfw: e.target.checked })}
            className="h-4 w-4 accent-[#FF4500]"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer py-1">
          <div>
            <div className="text-sm font-semibold">Blur NSFW previews until clicked</div>
          </div>
          <input
            type="checkbox"
            checked={settings.blurNsfw}
            onChange={(e) => updateSettings({ blurNsfw: e.target.checked })}
            className="h-4 w-4 accent-[#FF4500]"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer py-1">
          <div>
            <div className="text-sm font-semibold">Blur Spoiler previews until clicked</div>
          </div>
          <input
            type="checkbox"
            checked={settings.blurSpoilers}
            onChange={(e) => updateSettings({ blurSpoilers: e.target.checked })}
            className="h-4 w-4 accent-[#FF4500]"
          />
        </label>

        {/* Muted Keywords */}
        <div className="border-t border-[var(--or-border-subtle)] pt-3">
          <div className="text-xs font-bold">Muted Keywords (hidden from your feeds only)</div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
              placeholder="Add keyword or phrase to hide..."
              className="or-input flex-1 rounded-xl px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--or-pill)] px-4 py-2 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" /> Mute
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {settings.mutedKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--or-pill)] px-3 py-1 text-xs font-semibold"
              >
                {kw}
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      mutedKeywords: settings.mutedKeywords.filter((k) => k !== kw),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Muted Communities & Blocked Users */}
        {settings.mutedCommunities.length > 0 && (
          <div className="border-t border-[var(--or-border-subtle)] pt-3">
            <div className="mb-1.5 text-xs font-bold">Muted Communities</div>
            <div className="flex flex-wrap gap-1.5">
              {settings.mutedCommunities.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--or-pill)] px-3 py-1 text-xs font-semibold"
                >
                  r/{c}
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        mutedCommunities: settings.mutedCommunities.filter((x) => x !== c),
                      })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {settings.blockedUsers.length > 0 && (
          <div className="border-t border-[var(--or-border-subtle)] pt-3">
            <div className="mb-1.5 text-xs font-bold">Blocked Users</div>
            <div className="flex flex-wrap gap-1.5">
              {settings.blockedUsers.map((u) => (
                <span
                  key={u}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--or-pill)] px-3 py-1 text-xs font-semibold"
                >
                  u/{u}
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        blockedUsers: settings.blockedUsers.filter((x) => x !== u),
                      })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Data Portability */}
      {user && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] p-5">
          <div>
            <div className="text-sm font-bold">Export Your OpenRed Data</div>
            <div className="text-xs text-[var(--or-text-secondary)]">
              Download all your posts, comments, saved items, and votes as portable JSON.
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--or-border)] px-4 py-2 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
          >
            <Download className="h-4 w-4" /> Export JSON
          </button>
        </div>
      )}
    </div>
  );
}
