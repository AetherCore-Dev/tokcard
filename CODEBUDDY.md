# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Development Commands

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Preview | `npm run preview` |
| Deploy | `npm run deploy` |
| Typecheck | `npx tsc --noEmit` |

No lint or test scripts are configured.

## Architecture

**Stack:** Astro 6 + React 19 + Tailwind 4 static site deployed to Cloudflare Pages with KV storage.

### Routes (`src/pages/`)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `index.astro` | Marketing landing |
| `/create` | `create.astro` | Card editor |
| `/u` | `u.astro` | Shared card viewer |
| `/rank` | `rank.astro` | Leaderboard |

### Key Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `card.ts` | CardData interface, 10 themes, 6 social platforms, URL encode/decode for sharing |
| `titles.ts` | 7 title tiers and rank tiers based on token counts |
| `achievements.ts` | Dynamic badges (billion-club, claude-loyalist, etc.) |
| `metaphor.ts` | Viral metaphor generator (zh/en) |
| `deepseek.ts` | Client for DeepSeek AI text generation |

### Components (`src/components/`)

| File | Purpose |
|------|---------|
| `CardRenderer.tsx` | Card visualization, themes, QR code, avatars |
| `CardEditor.tsx` | Card creation UI, presets, export to image |
| `SharedCardLanding.tsx` | Renders shared card from URL or server data |
| `Leaderboard.tsx` | Token leaderboard with channel filtering |

### Edge Functions (`functions/`)

| Endpoint | File | Purpose |
|----------|------|---------|
| `/api/cards` | `api/cards.ts` | Store/retrieve card data in KV |
| `/api/leaderboard` | `api/leaderboard.ts` | Top 200 leaderboard |
| `/u/:id` | `u/[[path]].ts` | OG tag injection for social sharing |
| `/api/generate-*` | `api/generate-*.ts` | DeepSeek AI endpoints for slogans, metaphors, captions |
| `/api/og-image` | `api/og-image.ts` | Dynamic OG image generation |

Shared helpers live in `functions/lib/` (cors, rate-limit, leaderboard, deepseek).

### Data Flow

1. **Create:** CardEditor -> POST `/api/cards` -> KV stores card with 8-char ID -> returns `/u/{id}`
2. **Share:** Edge function at `/u/:id` injects OG meta for crawlers; browser renders SharedCardLanding
3. **Leaderboard:** Card save upserts leaderboard index in KV

### External Services

| Service | Purpose |
|---------|---------|
| Cloudflare KV | Card storage, leaderboard, rate limiting |
| DeepSeek API | AI-generated text |
| GitHub/DiceBear | Avatar sources |

## Path Aliases

`@/*` maps to `src/*` (tsconfig.json).

## Styling

Global styles in `src/styles/globals.css`. Tailwind 4 via Vite plugin.
