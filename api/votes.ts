import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromReq, parseBody } from './_lib/auth.js';
import { ensureReady } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = await ensureReady();
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Sign in required to vote' });
    }

    const body = parseBody(req);
    const targetType = String(body.targetType || '');
    const targetId = String(body.targetId || '').trim();
    const value = Number(body.value);

    if (targetType !== 'post' && targetType !== 'comment') {
      return res.status(400).json({ error: 'Invalid targetType' });
    }
    if (!targetId) {
      return res.status(400).json({ error: 'Missing targetId' });
    }
    if (value !== 1 && value !== -1 && value !== 0) {
      return res.status(400).json({ error: 'Vote value must be 1, -1, or 0' });
    }

    const prevRows = await sql`
      SELECT value FROM or_votes
      WHERE user_id = ${session.userId} AND target_type = ${targetType} AND target_id = ${targetId}
      LIMIT 1
    `;
    const prevValue = prevRows.length > 0 ? Number(prevRows[0].value) : 0;

    if (prevValue === value) {
      const currentRows =
        targetType === 'post'
          ? await sql`SELECT upvotes, downvotes, score FROM or_posts WHERE id = ${targetId} LIMIT 1`
          : await sql`SELECT upvotes, downvotes, score FROM or_comments WHERE id = ${targetId} LIMIT 1`;
      if (currentRows.length === 0) return res.status(404).json({ error: 'Target not found' });
      return res.status(200).json({
        upvotes: Number(currentRows[0].upvotes),
        downvotes: Number(currentRows[0].downvotes),
        score: Number(currentRows[0].score),
        userVote: value,
      });
    }

    let deltaUp = 0;
    let deltaDown = 0;
    if (prevValue === 1) deltaUp -= 1;
    if (prevValue === -1) deltaDown -= 1;
    if (value === 1) deltaUp += 1;
    if (value === -1) deltaDown += 1;
    const deltaScore = value - prevValue;

    if (value === 0) {
      await sql`
        DELETE FROM or_votes
        WHERE user_id = ${session.userId} AND target_type = ${targetType} AND target_id = ${targetId}
      `;
    } else {
      await sql`
        INSERT INTO or_votes (user_id, target_type, target_id, value)
        VALUES (${session.userId}, ${targetType}, ${targetId}, ${value})
        ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    const updated =
      targetType === 'post'
        ? await sql`
            UPDATE or_posts
            SET upvotes = GREATEST(0, upvotes + ${deltaUp}),
                downvotes = GREATEST(0, downvotes + ${deltaDown}),
                score = score + ${deltaScore}
            WHERE id = ${targetId}
            RETURNING upvotes, downvotes, score, author_id
          `
        : await sql`
            UPDATE or_comments
            SET upvotes = GREATEST(0, upvotes + ${deltaUp}),
                downvotes = GREATEST(0, downvotes + ${deltaDown}),
                score = score + ${deltaScore}
            WHERE id = ${targetId}
            RETURNING upvotes, downvotes, score, author_id
          `;

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const authorId = String(updated[0].author_id);
    if (authorId && authorId !== session.userId && deltaScore !== 0) {
      if (targetType === 'post') {
        await sql`
          UPDATE or_users SET post_karma = post_karma + ${deltaScore} WHERE id = ${authorId}
        `;
      } else {
        await sql`
          UPDATE or_users SET comment_karma = comment_karma + ${deltaScore} WHERE id = ${authorId}
        `;
      }
    }

    return res.status(200).json({
      upvotes: Number(updated[0].upvotes),
      downvotes: Number(updated[0].downvotes),
      score: Number(updated[0].score),
      userVote: value,
    });
  } catch (err: any) {
    console.error('Votes API error:', err);
    return res.status(500).json({ error: err?.message || 'Vote failed' });
  }
}
