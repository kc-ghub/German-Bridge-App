# Phase 2 Gameplay & Client-Authoritative Architecture Specification

## 1. Client-Authoritative Strategy (Current MVP Implementation)
- **Logic Location:** Core gameplay state updates, deck dealing, hand evaluations, turn progression, and bid calculations are executed client-side in [App.js](file:///c:/Local-files/App-dev/German-Bridge-App/App.js) using pure math functions from [src/core/gameEngine.js](file:///c:/Local-files/App-dev/German-Bridge-App/src/core/gameEngine.js).
- **Client Role:** The React Native frontend executes game logic, updates `game_state` JSONB in Supabase `rooms` table, and listens to Supabase Realtime updates for state synchronization.
- **Server Role:** Supabase PostgreSQL only validates room membership via RLS and broadcasts state changes via Realtime. No server-side game logic execution for MVP.
- **Post-MVP Roadmap:** Future phases will migrate critical game state transitions to server-authoritative Postgres RPC functions for anti-cheat protection.

## 2. Game Engine Core Math (`src/core/gameEngine.js`)

### Player & Deck Constraints
- **Player Count:** 3 to 8 players
- **Max Cards per Player:** `maxCards = Math.floor(52 / playerCount)`
- **Deck:** Standard 52-card deck (no Jokers)
- **Card Ranks:** 2 through Ace (Ace = 14, always high)
- **Suits:** Spades, Hearts, Diamonds, Clubs

### Round Mode Sequencing
- **Mountain Mode:** Starts at 1 card, increases to `maxCards`, then decreases back to 1. Total rounds: `2 * maxCards - 1`
- **Valley Mode:** Starts at `maxCards`, decreases to 1 card, then increases back to `maxCards`. Total rounds: `2 * maxCards - 1`
- **Flatline Mode:** Constant `maxCards` per round. Total rounds: `maxCards`

### Trump Determination
- **Revealed Trump:** Top card of remaining deck after dealing
- **No Trump (NT):** Only when `cardsCount * playerCount === 52` (all cards dealt, no deck remaining)

### Bidding System & "The Hook" Constraint
- **Bidding Order:** Clockwise starting from `initiativeSeat`
- **Forbidden Bid Calculation:** `calculateForbiddenBid(cardsDealt, existingBids) = cardsDealt - sum(existingBids)`
- **The Hook Enforcement:** Final bidder cannot select bid where total bids equal cards dealt. UI disables forbidden bid option.

### Trick Taking Logic
- **Follow-Suit Validation:** `isValidPlay(hand, playedCard, leadCard)` — Player must follow lead suit if possessing it
- **Trick Winner Resolution:** `resolveTrickWinner(trickCards, trumpCard)` — Highest trump wins, otherwise highest lead suit wins
- **Initiative Handover:** `initiativeSeat` transfers to winner of previous round's final trick

### Scoring System
- **Successful Contract:** `10 + Bid²`
- **Failed Contract:** `-(TricksWon - Bid)²`
- **Score Tracking:** Recorded per round in `game_state.scoreHistory`

## 3. Implemented UI/UX Features
- **Responsive Layout:** iPhone screen framing with adaptive card positioning
- **Hand Rendering:** Adaptive 14-17 card hand overlap/compression based on card count
- **Bidding Interface:** iOS-style bid wheel drum with smooth scrolling
- **Card Play:** Legal/illegal card highlighting with two-step elevate-and-confirm interaction
- **Trick Review:** 2-second `trickHold` window for completed trick visualization
- **Contract Indicator:** Bilingual Fight/Yield (`搶注` / `讓注`) display
- **Round Transition:** Configurable timer (5-15s or manual) via `game_state.config`
- **Scorecard:** Full match Scorecard modal showing all round history
- **Winner Podium:** Final match results display

## 4. Post-MVP Deferred Scope
- **Server-Authoritative RPCs:** Migrate game state transitions to Postgres functions
- **Bot Takeover:** Dynamic bot seats for disconnected players
- **Voice Chat:** Real-time in-game voice communication
- **Multi-Language:** `en_US` / `zh_HK` language switcher
- **Additional Games:** Support for 四十分, 爭上游 card games
- **User Profiles:** Permanent account system with login/password