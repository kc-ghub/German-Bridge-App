# App.js — Root Orchestrator (Modular MVP Implementation)

## Overview
Minimal React Native root orchestrator that serves as the lightweight entry point for the German Bridge application. Maintains Supabase Realtime connections, presence tracking, global state passing, and delegates all UI rendering to discrete feature modules.

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

### 4. State & Feature Module Orchestration
- **Feature Module Routing:** Delegates UI rendering to appropriate feature modules based on game phase (Lobby, GameBoard, Scorecard, Rules)
- **Global State Passing:** Passes `game_state`, `players`, `userId`, and room metadata to active feature modules
- **Sound Integration:** Routes sound events to `soundManager` service

## Key State Variables
- `userId` — Current authenticated user ID
- `currentRoom` — Active room object from Supabase
- `players` — Lobby player list from Presence channel
- `game_state` — Game state object (bids, hands, tricks, scores)
- `showScoreModal` — Scorecard modal visibility flag

## Dependencies
- `supabaseClient.js` — Supabase initialization
- `src/core/gameEngine.js` — Pure game rules and math functions
- `src/services/soundManager.js` — Web Audio sound synthesis
- `src/features/Lobby/LobbyScreen.js` — Pre-game lobby and room configuration UI
- `src/features/GameBoard/GameBoard.js` — Active match container UI
- `src/features/Scorecard/ScorecardModal.js` — Post-round score history UI
- `src/features/Rules/HowToPlayModal.js` — Game rules guide UI