import authHandler from '../../api/auth.js';
import commentsHandler from '../../api/comments.js';
import communitiesHandler from '../../api/communities.js';
import feedHandler from '../../api/feed.js';
import modHandler from '../../api/mod.js';
import postsHandler from '../../api/posts.js';
import socialHandler from '../../api/social.js';
import votesHandler from '../../api/votes.js';

type RouteHandler = (req: any, res: any) => Promise<any> | any;

const ROUTES: Record<string, RouteHandler> = {
  auth: authHandler,
  comments: commentsHandler,
  communities: communitiesHandler,
  feed: feedHandler,
  mod: modHandler,
  posts: postsHandler,
  social: socialHandler,
  votes: votesHandler,
};

export const onRequest = async (context: {
  request: Request;
  env: Record<string, any>;
  params: { path?: string | string[] };
}): Promise<Response> => {
  const { request, env, params } = context;

  // Bridge Cloudflare Pages env bindings into process.env for shared api/_lib helpers
  if (env?.DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = String(env.DATABASE_URL);
  }
  if (env?.POSTGRES_URL && !process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = String(env.POSTGRES_URL);
  }
  if (env?.AUTH_SECRET && !process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = String(env.AUTH_SECRET);
  }

  const rawPath = Array.isArray(params.path)
    ? params.path.join('/')
    : String(params.path || '');
  const routeKey = rawPath.replace(/^\/+|\/+$/g, '').split('/')[0];
  const handler = ROUTES[routeKey];

  if (!handler) {
    return new Response(JSON.stringify({ error: 'API route not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  let body: any = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = headers['content-type'] || '';
    const text = await request.text();
    if (text) {
      if (contentType.includes('application/json')) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      } else {
        body = text;
      }
    }
  }

  let statusCode = 200;
  const responseHeaders = new Headers();
  let responseBody: string | null = null;
  let finished = false;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | string[]) {
      if (Array.isArray(value)) {
        for (const v of value) responseHeaders.append(name, v);
      } else if (name.toLowerCase() === 'set-cookie') {
        responseHeaders.append(name, value);
      } else {
        responseHeaders.set(name, value);
      }
      return res;
    },
    json(data: unknown) {
      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
      }
      responseBody = JSON.stringify(data);
      finished = true;
      return res;
    },
    send(data: unknown) {
      if (typeof data === 'object' && data !== null) {
        return res.json(data);
      }
      responseBody = data === undefined || data === null ? '' : String(data);
      finished = true;
      return res;
    },
    end(data?: string) {
      if (data !== undefined) responseBody = data;
      finished = true;
      return res;
    },
  };

  const req = {
    method: request.method,
    url: request.url,
    headers,
    query,
    body,
  };

  try {
    await handler(req, res);
  } catch (err: any) {
    console.error('Cloudflare Pages API error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  return new Response(finished ? responseBody ?? '' : '', {
    status: statusCode,
    headers: responseHeaders,
  });
};
