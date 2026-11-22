import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { NotificationItem } from '../types';
import { timeAgo } from '../utils/format';
import { UserAvatar } from '../components/Avatar';

export function InboxPage() {
  const { user, openAuthModal, setUnreadNotifications, showToast } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'replies' | 'awards'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .getNotifications()
      .then((res) => setItems(res.notifications))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Bell className="mx-auto h-10 w-10 text-[#FF4500]" />
        <h1 className="mt-3 text-xl font-extrabold">Sign in to view your Inbox</h1>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="mt-4 rounded-full bg-[#FF4500] px-6 py-2 text-sm font-bold text-white"
        >
          Log In
        </button>
      </div>
    );
  }

  const handleMarkAll = async () => {
    await api.markNotificationsRead();
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    setUnreadNotifications(0);
    showToast('All notifications marked read', 'success');
  };

  const filtered = items.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'replies') return n.type === 'post_reply' || n.type === 'comment_reply' || n.type === 'mention';
    if (filter === 'awards') return n.type === 'award';
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Inbox &amp; Notifications</h1>
        <button
          type="button"
          onClick={handleMarkAll}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--or-border)] px-4 py-1.5 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
        >
          <CheckCheck className="h-4 w-4 text-[#46D160]" /> Mark all read
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {(
          [
            ['all', 'All'],
            ['unread', 'Unread'],
            ['replies', 'Replies & Mentions'],
            ['awards', 'Awards'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
              filter === id
                ? 'bg-[#FF4500] text-white'
                : 'bg-[var(--or-pill)] text-[var(--or-text-secondary)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)]">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--or-text-secondary)]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--or-text-secondary)]">
            No notifications in this tab.
          </div>
        ) : (
          filtered.map((n) => (
            <Link
              key={n.id}
              to={n.link}
              onClick={() => {
                if (!n.isRead) {
                  api.markNotificationsRead(n.id).catch(() => {});
                  setItems((prev) =>
                    prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
                  );
                  setUnreadNotifications((c) => Math.max(0, c - 1));
                }
              }}
              className={`flex items-start gap-3 border-b border-[var(--or-border-subtle)] p-4 last:border-0 hover:bg-[var(--or-surface-hover)] ${
                !n.isRead ? 'bg-[#FF4500]/5' : ''
              }`}
            >
              <UserAvatar
                username={n.actorUsername || 'O'}
                color={n.actorAvatarColor}
                size={34}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{n.title}</div>
                {n.body && (
                  <div className="mt-1 text-xs text-[var(--or-text-secondary)]">{n.body}</div>
                )}
                <div className="mt-1 text-[11px] text-[var(--or-text-muted)]">
                  {timeAgo(n.createdAt)}
                </div>
              </div>
              {!n.isRead && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#FF4500]" />}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
