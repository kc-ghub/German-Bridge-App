# Phase 2 Gameplay & Dynamic Bot Architecture Specification

## 1. Server-Authoritative Strategy
- **Logic Location:** Core gameplay state updates, deck dealing, hand evaluations, turn progression, and bot decision calculations are executed inside Supabase Postgres RPC functions (`execute_game_move`, `claim_room_seat`, etc.).
- **Client Role:** The React Native frontend strictly renders UI and listens to Supabase Realtime updates. No client browser acts as a bot driver or game state authority.

## 2. Dynamic Bot Metadata Model
- **No Static Accounts:** Bots do not use pre-seeded `auth.users` rows or fake UUIDs in `profiles`.
- **Seat Flags:** Bots are metadata-driven entries in `room_players`:
  - `is_bot` (BOOLEAN DEFAULT FALSE)
  - `bot_config` (JSONB) — Stores name, avatar index, and skill level.
  - `user_id` — NULL when pure bot, or set to original human UUID when taking over a disconnected player.

## 3. Disconnect & Reconnection Protocol (Hot-Swapping)
- **Mid-Game Disconnect:** If a human loses connection or misses heartbeats during a game, their seat updates to `status = 'disconnected'` and `is_bot = true`.
- **Bot Takeover:** The RPC engine automatically executes turn moves for the seat so the hand progresses.
- **Human Reclamation:** When the human reconnects, their client claims the seat, resetting `is_bot = false` and resuming play with their active hand.