# German Bridge — Project Charter & Master Blueprint

## 1. Project Overview
A real-time, cross-platform online card game application for "German Bridge" built with React Native (Expo) and Supabase. The platform supports anonymous guest entry, invitation-only quick rooms, Supabase Realtime state sync, and client-authoritative gameplay with Postgres RPC room management.

## 2. Technology Stack
- **Frontend Framework:** React Native via Expo (JavaScript) — monolithic [App.js](file:///c:/Local-files/App-dev/German-Bridge-App/App.js) handles all UI, state management, Supabase integration, deep-linking, and Web Audio sound synthesis
- **Backend / BaaS:** Supabase
  - **Auth:** Anonymous Sign-Ins only (no email/password login required for MVP)
  - **Database:** PostgreSQL with Row Level Security (RLS) — `rooms` table stores `game_state` as JSONB
  - **State Mechanics:** Client-authoritative game state synced via Supabase Realtime; room creation/joining uses Postgres RPC functions (`create_quick_room`, `join_room_with_passcode`, `verify_host_password`)
  - **Realtime:** Supabase Realtime Channels for state broadcast and Presence for lobby seating
- **Game Engine:** Pure JavaScript [src/core/gameEngine.js](file:///c:/Local-files/App-dev/German-Bridge-App/src/core/gameEngine.js) — decoupled game rules and math
- **Test Suite:** [src/core/testEngine.js](file:///c:/Local-files/App-dev/German-Bridge-App/src/core/testEngine.js) / `testEngine.mjs` — unit tests for game engine logic
- **Version Control:** Git & GitHub

## 3. Current MVP Architecture
- **File Structure:**
  - `App.js` — Monolithic UI layer, handles Supabase Realtime/Presence, deep-linking (`?room=XYZ` URL params), Web Audio sound synthesis, and all application state
  - `src/core/gameEngine.js` — Pure game rules and math (no side effects, fully testable)
  - `src/core/testEngine.js` — Unit test suite for game engine validation
  - `supabaseClient.js` — Supabase initialization
- **State Sync Model:** `game_state` (JSONB column in `rooms` table) is currently client-authoritative and synced via Supabase Realtime. Room creation/joining operations use Postgres RPCs for validation.

## 4. Implemented MVP Features
- **Room Entry Flow:** Invitation-only quick rooms with 3-digit `room_num` + 4-digit `passcode`, Supabase anonymous auth, host password verification (`verify_host_password`), URL deep-linking, and Supabase Realtime Presence for lobby seating
- **Game Rules Engine:** 3-8 player support, mountain/valley/flatline round modes, "The Hook" bidding constraint, follow-suit validation, trump/lead-suit trick resolution, exponential scoring
- **UI/UX:** Responsive iPhone screen framing, adaptive 14-17 card hand overlap/compression, iOS-style bid wheel drum, legal/illegal card highlighting with two-step elevate-and-confirm card play, 2-second `trickHold` review window, bilingual Fight/Yield (`搶注` / `讓注`) contract indicator, configurable round transition timer, full match Scorecard modal, Winner Podium
- **Sound:** Web Audio sound synthesis for bid placement, card play, and turn notifications

## 5. Multi-Phase Roadmap
- **Phase 1: Identity & Lobby Architecture** (COMPLETED)
  - Anonymous authentication flow.
  - Invitation-only quick room creation with 3-digit room number + 4-digit passcode.
  - Supabase Realtime Presence for lobby seating.
  - URL deep-linking (`?room=XYZ`) for one-click room joining.
  - Host password verification RPC.

- **Phase 2: Client-Authoritative Gameplay Engine** (COMPLETED)
  - Deck generation, dealing distribution, trump determination logic.
  - "The Hook" bidding constraint enforcement.
  - Follow-suit validation and trick winner resolution.
  - Exponential scoring system.
  - Round mode sequencing (mountain/valley/flatline).

- **Phase 3: UI/UX Polishing & Sound** (COMPLETED)
  - Responsive card rendering with adaptive overlap/compression.
  - iOS-style bid wheel drum interface.
  - Two-step elevate-and-confirm card play.
  - Trick hold review window.
  - Web Audio sound synthesis.
  - Scorecard modal and Winner Podium.

- **Phase 4: Post-MVP Enhancements** (DEFERRED)
  - User login/profiles system.
  - Multi-language switcher (`en_US` / `zh_HK`).
  - Additional card games (四十分, 爭上游).
  - Server-authoritative gameplay RPCs.
  - Voice chat integration.
  - Bot seat takeover for disconnected players.