import React from 'react';

export function OpenRedLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#FF4500" />
      <ellipse cx="32" cy="37" rx="18" ry="14" fill="#FFFFFF" />
      <circle cx="24" cy="34" r="3.4" fill="#FF4500" />
      <circle cx="40" cy="34" r="3.4" fill="#FF4500" />
      <path
        d="M24 42c2.5 2.5 5.2 3.5 8 3.5s5.5-1 8-3.5"
        fill="none"
        stroke="#FF4500"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M32 23l4-9 10 2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="16" r="4.5" fill="#FFFFFF" />
    </svg>
  );
}

export function UserAvatar({
  username,
  color = '#FF4500',
  avatarUrl,
  size = 32,
}: {
  username: string;
  color?: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`u/${username}`}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover border border-[var(--or-border)]"
      />
    );
  }
  const initial = (username || '?').slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color || '#FF4500',
        fontSize: Math.max(10, Math.round(size * 0.44)),
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none"
    >
      {initial}
    </div>
  );
}
