# Phase 1 Technical Baseline & Database Schema

## 1. Database Schema Overview

### `profiles` Table
- `id` (UUID, Primary Key -> `auth.users.id`)
- `nickname` (TEXT)
- `avatar_index` (INT)
- `title` (TEXT)

### `rooms` Table
- `id` (VARCHAR, Primary Key) — Desk identifier (e.g., MOU123, VAL456)
- `host_id` (UUID, Foreign Key -> `profiles.id`, Nullable)
- `status` (VARCHAR) — `'lobby'`, `'playing'`, `'completed'`
- `max_players` (INT) — Default 4
- `round_mode` (VARCHAR) — `'mountain'`, `'valley'`, `'flatline'`

### `room_players` Table
- `room_id` (VARCHAR -> `rooms.id`)
- `user_id` (UUID -> `profiles.id`)
- `seat_number` (INT) — Range 1–4
- `status` (VARCHAR) — `'active'`, `'idle'`, `'disconnected'`, `'released'`
- `last_active_at` (TIMESTAMPTZ)
- `shadow_id` (UUID)

### `game_config` Table
- Name/Value key pairs configuring `idle_timeout_seconds`, `keepalive_interval_seconds`, `keepalive_miss_limit`, and `idle_cleanup_enabled`.

## 2. Core Operational Logic
- **System Lobby UUID:** `00000000-0000-0000-0000-000000000000` automatically maintains three open public desks (`mountain`, `valley`, `flatline`).
- **Lobby Resiliency:** Clients periodically clean up expired seats based on heartbeat timestamps before querying available seats.
- **Role Restrictions:** Guests can join public desks; only registered members can host private rooms.
