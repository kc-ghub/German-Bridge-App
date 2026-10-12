# German Bridge — Project Charter & Master Blueprint

## 1. Project Overview
A real-time, cross-platform online card game application for "German Bridge" built with React Native (Expo) and Supabase. The platform supports anonymous guest entry, account persistence, public/private match rooms, resilient presence tracking, and server-authoritative bot takeover.

## 2. Technology Stack
- **Frontend Framework:** React Native via Expo (JavaScript)
- **Backend / BaaS:** Supabase
  - **Auth:** Anonymous Sign-Ins, Email/Password Upgrades & Account Switching
  - **Database:** PostgreSQL with Row Level Security (RLS)
  - **State Mechanics:** Server-Authoritative Postgres RPC Functions
  - **Realtime:** Supabase Realtime Channels for state broadcast
- **Version Control:** Git & GitHub

## 3. High-Level Multi-Phase Roadmap
- **Phase 1: Identity & Lobby Architecture** (COMPLETED)
  - Anonymous & permanent authentication.
  - Self-healing public desks, host-restricted private room creation.
  - Presence tracking, seat heartbeats, and idle seat release routines.
- **Phase 2: Server-Authoritative Gameplay & Dynamic Bot Engine** (IN PROGRESS)
  - Deck generation, dealing distribution, trump determination.
  - Dynamic bot seats using metadata flags in `room_players`.
  - Mid-game human disconnect takeover and seamless human reclamation.
  - Turn engine driven by Supabase Postgres RPC functions.
- **Phase 3: Turn Execution & Trick Evaluation** (DEFERRED)
- **Phase 4: Scoring Matrices & Match Resolution** (DEFERRED)
- **Phase 5: UI/UX Polishing & Network Resiliency** (DEFERRED)