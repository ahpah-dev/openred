import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import type { ModLogEntry } from '../types';
import { timeAgo } from '../utils/format';
import { UserAvatar } from '../components/Avatar';

export function ModLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { allCommunities } = useApp();
  const [communityFilter, setCommunityFilter] = useState(searchParams.get('community') || '');
  const [logs, setLogs] = useState<ModLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getModLogs(communityFilter)
      .then((res) => setLogs(res.logs))
      .finally(() => setLoading(false));
  }, [communityFilter]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#46D160]/15 text-[#46D160]">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">Public Moderation Transparency Log</h1>
            <p className="text-xs text-[var(--or-text-secondary)]">
              Zero secret censorship. Every pin, lock, removal, restoration, or ban is permanently recorded here.
            </p>
          </div>
        </div>

        <select
          value={communityFilter}
          onChange={(e) => {
            setCommunityFilter(e.target.value);
            if (e.target.value) setSearchParams({ community: e.target.value });
            else setSearchParams({});
          }}
          className="or-input rounded-full px-4 py-2 text-xs font-bold"
        >
          <option value="">All Communities</option>
          {allCommunities.map((c) => (
            <option key={c.id} value={c.name}>
              r/{c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--or-border)] bg-[var(--or-surface)]">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--or-text-secondary)]">
            Loading audit log...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--or-text-secondary)]">
            No moderation actions recorded for this filter.
          </div>
        ) : (
          <div className="divide-y divide-[var(--or-border-subtle)]">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[#46D160]/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#46D160]">
                      {log.action}
                    </span>
                    <Link to={`/r/${log.communityName}`} className="font-bold hover:underline">
                      {log.communityIconEmoji} r/{log.communityName}
                    </Link>
                    <span className="text-[var(--or-text-muted)]">• {timeAgo(log.createdAt)}</span>
                  </div>

                  <div className="text-sm font-semibold">{log.targetSummary}</div>
                  <div className="text-xs text-[var(--or-text-secondary)]">
                    Reason: <span className="text-[var(--or-text)]">{log.reason}</span>
                  </div>
                </div>

                <Link
                  to={`/u/${log.moderatorUsername}`}
                  className="flex items-center gap-2 rounded-full bg-[var(--or-surface-elevated)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--or-surface-hover)]"
                >
                  <UserAvatar
                    username={log.moderatorUsername}
                    color={log.moderatorAvatarColor}
                    size={20}
                  />
                  <span>u/{log.moderatorUsername}</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
