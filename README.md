# OpenRed

**Live Site (Cloudflare Pages):** https://openred-agg.pages.dev

**OpenRed** is an open-source, uncensored Reddit alternative built with React 19, TypeScript, Tailwind CSS v4, Cloudflare Pages Functions (and Vercel Serverless Functions), and Neon Serverless Postgres.

## Why OpenRed?

- **Zero Shadowbans:** Posts and comments are never silently hidden or downranked covertly.
- **Public Moderation Log (`/modlog`):** Every moderator action (pins, locks, removals, restorations, moderator appointments, bans) requires a public reason and is permanently logged for everyone to inspect.
- **Zero-Moderation Free-Speech Zones:** Any community creator can enable Unmoderated Mode, locking out removals, thread locks, and bans at the backend API level.
- **No Fake Content:** Starts completely clean — every community, post, and comment is created by real users.
- **Personal Client-Side Filtering (`/settings`):** Mute keywords, mute communities, block users, or toggle NSFW/spoiler blurring locally in your browser without censoring anyone else.
- **No Email Required:** Register with just a username and password.

## Features

- **Authentic Reddit Interface:** Dark & Light mode, plus **Card**, **Compact**, and **Classic (Old Reddit)** feed views.
- **All Reddit Ranking Algorithms:** `Hot`, `Best` (Wilson score), `New`, `Top`, `Rising`, and `Controversial` with time filters (`Past Hour`, `Today`, `Week`, `Month`, `Year`, `All Time`).
- **Rich Post Types:** Text (Markdown with tables, fenced code blocks, quotes, and click-to-reveal `>!spoilers!<`), Image & Multi-Image Gallery Carousels with Lightbox, Link cards, Video, Interactive Polls, and Crossposts.
- **Nested Threaded Comments:** Recursive comment trees with clickable vertical collapse bars, `Best / Top / New / Controversial / Old / Q&A` sorting, inline comment search, OP & MOD badges, and Markdown editor.
- **Communities & Custom Feeds:** Create communities (`r/...`), join, star favorites, pick user & post flairs, and combine communities into Custom Feeds (Multireddits).
- **Social & Live Chat:** User profiles with Karma, Cake Day, Trophies, Follow/Block, Notifications Inbox, and a floating real-time Chat Drawer (`#openred-lobby` + 1-on-1 DMs).
- **Portable Data:** Export your profile, posts, comments, saved items, and votes as JSON anytime.

## Tech Stack

- **Frontend:** Vite 6, React 19, TypeScript, Tailwind CSS v4, React Router v7, Lucide Icons
- **Backend:** Vercel Serverless Functions (`@vercel/node`) + Neon Serverless Postgres (`@neondatabase/serverless`)
- **Auth:** `scrypt` password hashing + HMAC-SHA256 signed `HttpOnly` cookie & Bearer tokens

## Local Development & Self-Hosting

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set `DATABASE_URL` to a PostgreSQL / Neon connection string (in `.env` or Vercel project environment variables).
3. Run locally with `vercel dev` or build the frontend with:
   ```bash
   npm run build
   ```
4. Deploy to Vercel:
   ```bash
   npx vercel --prod
   ```
