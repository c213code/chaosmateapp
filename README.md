# ChaosMate ♟️

> Chess. Reimagined. Built for the next generation of players.

## What is ChaosMate?
ChaosMate is a premium chess platform with unique game modes that don't exist anywhere else. Built as a startup-ready product, not just another chess board.

## Unique Game Modes
- **Switch Places** — mid-game the colors swap. You must play the other side.
- **Fog of War** — you only see what your pieces can reach
- **Chaos Mode** — pieces randomly teleport every few moves
- **2v2 Team Chess** — 4 players, 2 teams, coordinated strategy

## Who is this for?
Chess players aged 16–30 who want more than just classical chess. Casual gamers who want fun chaotic modes. Competitive players who want ELO and rankings.

## Why is this valuable?
- No other platform offers Switch Places or 2v2 team chess
- AI Coach gives value after every game (retention)
- Kazakhstan-first leaderboard creates local community
- Monetization-ready with coins, skins, and Pro tier

## Tech Stack
Next.js 14, TypeScript, Supabase, Stockfish.js, chess.js, Tailwind CSS, Socket.io

## Implemented Product Surface
- Premium dark landing experience with animated chess-board hero
- Playable chess board powered by `chess.js` move validation
- Classic vs AI mode using a Web Worker Stockfish adapter
- Dedicated pages for Classic, Local, Switch Places, 2v2, Fog of War, Chaos Mode, and Speed Chess
- AI / Local / Online mode selection page
- Online rooms with create/join flow and Supabase Realtime subscriptions
- Switch Places countdown and board/control flip at random 5-10 move intervals
- Fog overlay based on legal move vision
- Chaos teleport effect for random opponent non-king pieces
- Check/checkmate/stalemate result flow with profile rewards
- Timers, captures, move history, resign/draw controls, AI Coach panel
- Profile, per-mode ELO, coins, piece skins, Pro CTA, shop, Kazakhstan leaderboard
- Supabase client placeholders and SQL schema in `supabase/schema.sql`

## Environment Variables
Create `.env.local` when connecting a real Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`.env.local` and all `.env*` files are ignored by git. Do not commit API keys.

## Dev Notes for Codex
- Use chess.js for ALL move validation — never implement rules manually
- Stockfish runs in a Web Worker to not block UI
- For Switch Places: swap the `orientation` of the board AND re-assign which color each player controls in game state
- For 2v2: each of 4 browser tabs connects to same game room via Supabase Realtime channel
- Start with: auth → classic game → one unique mode → then layer features
- Use Supabase Row Level Security on all tables

## Run Locally

```bash
npm install
npm run dev
```
