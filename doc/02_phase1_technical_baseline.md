# Phase 1 Technical Baseline & Database Schema

## 1. Current Database Schema Overview

### `rooms` Table
- `id` (VARCHAR, Primary Key) — 3-digit numeric room identifier (e.g., 123, 456)
- `host_id` (UUID, Foreign Key -> `profiles.id`) — Room host user ID
- `status` (VARCHAR) — `'lobby'`, `'playing'`, `'completed'`
- `max_players` (INT) — Configurable from 3 to 8 players
- `round_mode` (VARCHAR) — `'mountain'`, `'valley'`, `'flatline'`
- `passcode` (VARCHAR) — 4-digit numeric passcode for room joining
- `game_state` (JSONB) — Client-authoritative game state object containing:
  - `roundNumber`, `totalRounds`, `mode`, `cardsDealt`, `maxCards`
  - `players`, `initiativeSeat`, `activeSeat`
  - `trumpCard`, `isNoTrump`
  - `hands`, `bids`, `trick`, `tricksWon`
  - `lastTrickResult`, `roundScores`, `cumulativeScores`, `scoreHistory`
  - `phase` (`'bidding'`, `'trick'`, `'scoring'`)
  - `config` (round transition timer settings)

### `profiles` Table
- `id` (UUID, Primary Key -> `auth.users.id`)
- `nickname` (TEXT) — Player display name
- `avatar_index` (INT) — Avatar selection index

### `room_players` Table
- `room_id` (VARCHAR -> `rooms.id`)
- `user_id` (UUID -> `profiles.id`)
- `seat_number` (INT) — Range 1–max_players
- `status` (VARCHAR) — `'active'` (used for game start tracking)

## 2. Core Operational Logic

### Room Entry & Authentication Flow
- **Auth Method:** Supabase Anonymous Sign-Ins only for MVP. No email/password authentication required.
- **Room Creation:** Host creates quick room via `create_quick_room` RPC, providing 3-digit `room_num`, 4-digit `passcode`, `max_players`, and `round_mode`.
- **Host Verification:** Host identity verified via `verify_host_password` RPC using a shared host password.
- **Room Joining:** Invitees join via `join_room_with_passcode` RPC, providing 3-digit `room_num` and 4-digit `passcode`.
- **Deep-Linking:** URL parameter `?room=XYZ` automatically populates room number in join form for one-click room access.

### Lobby Presence System
- **Realtime Presence:** Supabase Realtime Presence channel (`presence_room_{room_id}`) manages lobby seating.
- **Seat Assignment:** Seats are dynamically assigned based on presence join order, with host always seated at seat 1.
- **Session Persistence:** Active game session stored in `localStorage` for automatic reconnection on page refresh.

### Game State Sync
- **State Model:** `game_state` JSONB column in `rooms` table is client-authoritative.
- **Sync Mechanism:** Supabase Realtime `postgres_changes` subscription on `rooms` table UPDATE events syncs state across all clients.
- **Room Operations:** Only room creation, joining, and host verification use Postgres RPCs; all game state mutations are client-driven.

## 3. Implemented RPC Functions
- `verify_host_password(p_password TEXT)` — Verifies host authentication password
- `create_quick_room(p_host_id UUID, p_nickname TEXT, p_room_num TEXT, p_passcode TEXT, p_max_players INT, p_round_mode TEXT)` — Creates new quick room
- `join_room_with_passcode(p_room_num TEXT, p_passcode TEXT, p_nickname TEXT)` — Joins existing room with passcode