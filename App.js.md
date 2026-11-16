# App.js — Main Application Component (MVP Implementation)

## Overview
Monolithic React Native component that serves as the complete UI layer and state management hub for the German Bridge MVP. Handles all Supabase integration, game state synchronization, user interactions, and rendering.

## Core Responsibilities

### 1. Session & Authentication Management
- **Anonymous Auth:** Automatically signs in with Supabase anonymous authentication on initial load
- **Deep-Link Handling:** Parses URL parameter `?room=XYZ` for one-click room joining
- **Session Persistence:** Stores active game session in `localStorage` for automatic reconnection
- **Host Authentication:** Validates host identity via `verify_host_password` RPC

### 2. Room & Lobby Management
- **Room Creation:** Host creates quick rooms via `create_quick_room` RPC with 3-digit `room_num`, 4-digit `passcode`, `max_players`, and `round_mode`
- **Room Joining:** Invitees join via `join_room_with_passcode` RPC
- **Realtime Presence:** Manages Supabase Realtime Presence channel for dynamic lobby seating
- **Invite Link Generation:** Generates shareable deep-link URL (`/?room=XYZ`) for room invitations

### 3. Game State Synchronization
- **Realtime Subscription:** Listens to Supabase `postgres_changes` on `rooms` table UPDATE events
- **State Management:** Maintains local `game_state` object synced with Supabase JSONB column
- **Phase Tracking:** Monitors game phase transitions (`bidding` → `trick` → `scoring`)

### 4. Game Execution Logic
- **Game Initialization:** Deals initial hands, determines trump card, sets initiative seat
- **Bidding Handling:** Validates "The Hook" constraint, submits bids to Supabase
- **Card Play:** Validates follow-suit rules, resolves tricks, updates scores
- **Round Progression:** Manages round transitions with configurable timer (5-15s or manual)
- **Game Completion:** Displays Winner Podium and final Scorecard modal

### 5. UI Rendering
- **Responsive Layout:** iPhone screen framing with adaptive card positioning
- **Hand Rendering:** Adaptive 14-17 card hand overlap/compression
- **Bid Wheel:** iOS-style bid wheel drum with smooth scrolling
- **Card Interaction:** Two-step elevate-and-confirm card play with legal/illegal highlighting
- **Trick Visualization:** 2-second `trickHold` review window for completed tricks
- **Scorecard Modal:** Full match history display
- **Winner Podium:** Final match results presentation

### 6. Sound System
- **Web Audio Synthesis:** Integrates `soundManager` from `src/utils/soundManager.js`
- **Sound Events:** Plays bid placement, card play, and "your turn" notification sounds
- **Mute Control:** Provides sound toggle UI

## Key State Variables
- `userId` — Current authenticated user ID
- `currentRoom` — Active room object from Supabase
- `players` — Lobby player list from Presence channel
- `game_state` — Game state object (bids, hands, tricks, scores)
- `selectedBid` — Currently selected bid in bid wheel
- `selectedCardIdx` — Currently selected card index
- `trickHold` — Boolean flag for trick review window
- `roundCountdown` — Round transition timer display
- `showScoreModal` — Scorecard modal visibility flag

## Dependencies
- `supabaseClient.js` — Supabase initialization
- `src/core/gameEngine.js` — Pure game rules and math functions
- `src/utils/soundManager.js` — Web Audio sound synthesis
- React Native Animated — Card animation system