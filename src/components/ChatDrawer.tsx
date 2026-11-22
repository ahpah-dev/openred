import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, UserPlus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { ChatMessage, ChatRoom } from '../types';
import { timeAgo } from '../utils/format';
import { UserAvatar } from './Avatar';

export function ChatDrawer() {
  const { user, chatOpen, setChatOpen, chatRoomId, setChatRoomId, openAuthModal, showToast } =
    useApp();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [newUser, setNewUser] = useState('');
  const [showNewDm, setShowNewDm] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadRoom = async (room = chatRoomId) => {
    try {
      const res = await api.getMessages(room);
      setRooms(res.rooms);
      setMessages(res.messages);
    } catch {
      // ignore transient error
    }
  };

  useEffect(() => {
    if (!chatOpen) return;
    loadRoom(chatRoomId);
    const id = setInterval(() => loadRoom(chatRoomId), 5000);
    return () => clearInterval(id);
  }, [chatOpen, chatRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!chatOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await api.sendMessage({ roomId: chatRoomId, body: draft.trim() });
      setMessages((prev) => [...prev, res.message]);
      setDraft('');
    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleStartDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    const clean = newUser.trim().replace(/^u\//i, '');
    if (!clean) return;
    try {
      const res = await api.getMessages('global:lobby', clean);
      setChatRoomId(res.roomId);
      setRooms(res.rooms);
      setMessages(res.messages);
      setNewUser('');
      setShowNewDm(false);
    } catch (err: any) {
      showToast(err.message || 'User not found', 'error');
    }
  };

  const activeRoom = rooms.find((r) => r.roomId === chatRoomId);

  return (
    <div className="fixed bottom-3 right-3 z-[65] flex h-[470px] w-[min(94vw,430px)] flex-col overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--or-border)] bg-[var(--or-surface-elevated)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#FF4500]" />
          <span className="text-sm font-bold">
            {activeRoom?.label || '#openred-lobby'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowNewDm((v) => !v)}
            title="Start DM with user"
            className="rounded-full p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            className="rounded-full p-1.5 text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)] hover:text-[var(--or-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* New DM bar */}
      {showNewDm && (
        <form
          onSubmit={handleStartDm}
          className="flex items-center gap-2 border-b border-[var(--or-border)] bg-[var(--or-surface)] px-3 py-2"
        >
          <input
            type="text"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            placeholder="Enter username..."
            className="or-input flex-1 rounded-full px-3 py-1 text-xs"
          />
          <button
            type="submit"
            className="rounded-full bg-[#FF4500] px-3 py-1 text-xs font-bold text-white"
          >
            Open DM
          </button>
        </form>
      )}

      {/* Split Rooms + Messages */}
      <div className="flex min-h-0 flex-1">
        <div className="w-32 shrink-0 overflow-y-auto border-r border-[var(--or-border-subtle)] bg-[var(--or-surface)] p-1.5 space-y-1">
          {rooms.map((r) => (
            <button
              key={r.roomId}
              type="button"
              onClick={() => setChatRoomId(r.roomId)}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold truncate ${
                r.roomId === chatRoomId
                  ? 'bg-[#FF4500]/15 text-[#FF4500]'
                  : 'text-[var(--or-text-secondary)] hover:bg-[var(--or-surface-hover)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--or-text-muted)]">
                No messages here yet. Say hello!
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex items-start gap-2">
                  <UserAvatar
                    username={m.senderUsername}
                    color={m.senderAvatarColor}
                    size={24}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold">u/{m.senderUsername}</span>
                      <span className="text-[10px] text-[var(--or-text-muted)]">
                        {timeAgo(m.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed text-[var(--or-text)] break-words">
                      {m.body}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-[var(--or-border-subtle)] p-2.5"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={user ? 'Message...' : 'Log in to chat'}
              className="or-input flex-1 rounded-full px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF4500] text-white hover:bg-[#ff5414] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
