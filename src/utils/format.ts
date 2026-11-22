export function formatCount(num: number): string {
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(num);
}

export function timeAgo(iso: string): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(mo / 12);
  return `${yr}y ago`;
}

export function extractDomain(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export interface AwardDefinition {
  id: string;
  emoji: string;
  name: string;
  description: string;
  color: string;
}

export const AWARDS: AwardDefinition[] = [
  { id: 'torch', emoji: '🔥', name: 'Free Speech Torch', description: 'Unfiltered truth & courage', color: '#FF4500' },
  { id: 'gold', emoji: '🏆', name: 'OpenRed Gold', description: 'Outstanding contribution', color: '#EAB308' },
  { id: 'silver', emoji: '🥈', name: 'Silver Medal', description: 'Well argued & worthy', color: '#94A3B8' },
  { id: 'helpful', emoji: '🤝', name: 'Helpful', description: 'Saved somebody hours of time', color: '#22C55E' },
  { id: 'mindblown', emoji: '🤯', name: 'Mind Blown', description: 'Genuinely eye-opening insight', color: '#A855F7' },
  { id: 'wholesome', emoji: '💖', name: 'Wholesome', description: 'Made the thread better', color: '#EC4899' },
  { id: 'based', emoji: '🗽', name: 'Uncensored', description: 'Said what needed to be said', color: '#F59E0B' },
  { id: 'classic', emoji: '⚡', name: 'Instant Classic', description: 'Hall-of-fame OpenRed thread', color: '#38BDF8' },
];

export const AWARD_MAP: Record<string, AwardDefinition> = Object.fromEntries(
  AWARDS.map((a) => [a.id, a])
);

export const COMMUNITY_CATEGORIES = [
  'All',
  'Meta & Governance',
  'Technology',
  'Debate & Culture',
  'Q&A',
  'News & Politics',
  'Security & Privacy',
  'Entertainment',
  'Science',
  'General',
];
