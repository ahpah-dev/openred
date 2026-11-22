export type PostSort = 'hot' | 'best' | 'new' | 'top' | 'rising' | 'controversial';
export type CommentSort = 'best' | 'top' | 'new' | 'controversial' | 'old' | 'qa';
export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

const REDDIT_EPOCH = 1134028003;

export function hotScore(upvotes: number, downvotes: number, createdAt: string | Date): number {
  const s = upvotes - downvotes;
  const order = Math.log10(Math.max(Math.abs(s), 1));
  const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
  const seconds = Math.floor(new Date(createdAt).getTime() / 1000) - REDDIT_EPOCH;
  return Number((sign * order + seconds / 45000).toFixed(7));
}

export function wilsonScore(upvotes: number, downvotes: number): number {
  const n = upvotes + downvotes;
  if (n <= 0) return 0;
  const z = 1.96;
  const p = upvotes / n;
  const z2 = z * z;
  const numerator =
    p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  const denominator = 1 + z2 / n;
  return numerator / denominator;
}

export function controversialScore(upvotes: number, downvotes: number): number {
  if (upvotes <= 0 || downvotes <= 0) return 0;
  const magnitude = upvotes + downvotes;
  const balance =
    upvotes > downvotes ? downvotes / upvotes : upvotes / downvotes;
  return Math.pow(magnitude, balance);
}

export function risingScore(
  upvotes: number,
  downvotes: number,
  commentCount: number,
  createdAt: string | Date
): number {
  const ageHours = Math.max(
    0.25,
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  );
  const score = upvotes - downvotes;
  return (Math.max(score, 0) + commentCount * 1.5) / Math.pow(ageHours + 1, 1.35);
}

export function getTimeCutoff(timeRange: string | undefined): Date | null {
  const now = Date.now();
  switch (timeRange) {
    case 'hour':
      return new Date(now - 1000 * 60 * 60);
    case 'day':
      return new Date(now - 1000 * 60 * 60 * 24);
    case 'week':
      return new Date(now - 1000 * 60 * 60 * 24 * 7);
    case 'month':
      return new Date(now - 1000 * 60 * 60 * 24 * 30);
    case 'year':
      return new Date(now - 1000 * 60 * 60 * 24 * 365);
    default:
      return null;
  }
}

export function sortPosts<
  T extends {
    upvotes: number;
    downvotes: number;
    score: number;
    commentCount: number;
    createdAt: string;
    isPinned?: boolean;
  }
>(posts: T[], sort: PostSort = 'hot', respectPins = false): T[] {
  const list = [...posts];
  list.sort((a, b) => {
    if (respectPins && Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    switch (sort) {
      case 'new':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'top':
        return b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'best':
        return (
          wilsonScore(b.upvotes, b.downvotes) - wilsonScore(a.upvotes, a.downvotes) ||
          b.score - a.score
        );
      case 'rising':
        return (
          risingScore(b.upvotes, b.downvotes, b.commentCount, b.createdAt) -
          risingScore(a.upvotes, a.downvotes, a.commentCount, a.createdAt)
        );
      case 'controversial':
        return (
          controversialScore(b.upvotes, b.downvotes) -
            controversialScore(a.upvotes, a.downvotes) ||
          b.commentCount - a.commentCount
        );
      case 'hot':
      default:
        return (
          hotScore(b.upvotes, b.downvotes, b.createdAt) -
          hotScore(a.upvotes, a.downvotes, a.createdAt)
        );
    }
  });
  return list;
}

export function sortComments<
  T extends {
    upvotes: number;
    downvotes: number;
    score: number;
    createdAt: string;
    isPinned?: boolean;
    authorId?: string | null;
  }
>(comments: T[], sort: CommentSort = 'best', postAuthorId?: string | null): T[] {
  const list = [...comments];
  list.sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    switch (sort) {
      case 'top':
        return b.score - a.score || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'new':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'old':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'controversial':
        return (
          controversialScore(b.upvotes, b.downvotes) -
            controversialScore(a.upvotes, a.downvotes) ||
          b.upvotes + b.downvotes - (a.upvotes + a.downvotes)
        );
      case 'qa': {
        const aIsOp = Boolean(postAuthorId && a.authorId === postAuthorId);
        const bIsOp = Boolean(postAuthorId && b.authorId === postAuthorId);
        if (aIsOp !== bIsOp) return aIsOp ? -1 : 1;
        return wilsonScore(b.upvotes, b.downvotes) - wilsonScore(a.upvotes, a.downvotes);
      }
      case 'best':
      default:
        return (
          wilsonScore(b.upvotes, b.downvotes) - wilsonScore(a.upvotes, a.downvotes) ||
          b.score - a.score
        );
    }
  });
  return list;
}
