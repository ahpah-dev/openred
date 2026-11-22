import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, LockOpen, Scale, ShieldCheck, Sliders } from 'lucide-react';

export function CharterPage() {
  const pillars = [
    {
      icon: <Eye className="h-6 w-6 text-[#FF4500]" />,
      title: 'Zero Shadowbans, Ever',
      desc: 'OpenRed never silently hides your posts, downranks threads covertly, or pretends your comments are visible while hiding them from others.',
    },
    {
      icon: <Scale className="h-6 w-6 text-[#46D160]" />,
      title: '100% Public Moderation Logs',
      desc: 'Every single moderator action — pinning, locking, removing, restoring, or banning — requires a visible reason and is published permanently at /modlog.',
    },
    {
      icon: <LockOpen className="h-6 w-6 text-[#f59e0b]" />,
      title: 'Zero-Moderation Free-Speech Zones',
      desc: 'Any community creator can flip on Unmoderated Mode when creating a community, which locks out removals, thread locks, and bans in backend code.',
    },
    {
      icon: <Sliders className="h-6 w-6 text-[#4fbcff]" />,
      title: 'Personal Client-Side Filtering',
      desc: 'Control your own experience without censoring anyone else: mute keywords, blur NSFW/spoilers, mute communities, or block users locally in /settings.',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="rounded-3xl border border-[var(--or-border)] bg-[var(--or-surface)] p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#FF4500]/15 px-3 py-1 text-xs font-bold text-[#FF4500]">
          <ShieldCheck className="h-4 w-4" /> OpenRed Free-Speech Charter
        </div>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
          Open community discussion without hidden gatekeepers.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--or-text-secondary)]">
          OpenRed replicates the full Reddit community experience — subreddits, nested threads,
          voting algorithms, polls, awards, custom feeds, live chat, and flair — while replacing
          opaque corporate censorship with transparent, user-controlled rules.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-[var(--or-border-subtle)] bg-[var(--or-surface-elevated)] p-4"
            >
              {p.icon}
              <h2 className="mt-2.5 text-sm font-bold">{p.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--or-text-secondary)]">
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/modlog"
            className="rounded-full bg-[#FF4500] px-5 py-2 text-xs font-bold text-white hover:bg-[#ff5414]"
          >
            Inspect Live Mod Log
          </Link>
          <Link
            to="/explore"
            className="rounded-full border border-[var(--or-border)] px-5 py-2 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
          >
            Explore Communities
          </Link>
          <Link
            to="/settings"
            className="rounded-full border border-[var(--or-border)] px-5 py-2 text-xs font-bold hover:bg-[var(--or-surface-hover)]"
          >
            Configure Personal Filters
          </Link>
        </div>
      </div>
    </div>
  );
}
