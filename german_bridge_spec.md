# Technical Game Specifications: German Bridge (德國橋牌) — MVP Implementation

## 1. Current Architecture & File Structure

### 1.1 MVP Implementation Stack
* **UI Layer:** Monolithic [App.js](file:///c:/Local-files/App-dev/German-Bridge-App/App.js) — handles all React Native rendering, Supabase Realtime/Presence integration, URL deep-linking (`?room=XYZ`), Web Audio sound synthesis, and application state management
* **Game Engine:** Pure decoupled [src/core/gameEngine.js](file:///c:/Local-files/App-dev/German-Bridge-App/src/core/gameEngine.js) — side-effect free game rules and math functions
* **Test Suite:** [src/core/testEngine.js](file:///c:/Local-files/App-dev/German-Bridge-App/src/core/testEngine.js) / `testEngine.mjs` — unit test validation for all engine logic
* **State Sync:** `game_state` JSONB column in Supabase `rooms` table — client-authoritative, synced via Supabase Realtime
* **Room Operations:** Postgres RPC functions (`create_quick_room`, `join_room_with_passcode`, `verify_host_password`) for room creation/joining only

### 1.2 Core Game Components
* **Deck:** Standard 52-card deck (No Jokers). 
* **Card Ranks:** 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A (Ace = 14, always high).
* **Suits:** Spades, Hearts, Diamonds, Clubs.

---

## 2. Room Entry, Auth & Lobby Flow (Implemented)

### 2.1 Authentication Model
* **Current MVP:** Supabase Anonymous Sign-Ins only. No email/password login required.
* **Post-MVP Roadmap:** User login/profiles, account persistence, and email/password authentication are deferred to future phases.

### 2.2 Quick Room Creation & Joining
* **Room Identifier:** 3-digit numeric `room_num` (e.g., 123, 456)
* **Room Passcode:** 4-digit numeric `passcode` for invitation-only access
* **Host Verification:** `verify_host_password` RPC validates host authentication
* **Creation Flow:** Host uses `create_quick_room` RPC to configure `max_players` (3-8) and `round_mode`
* **Joining Flow:** Invitees use `join_room_with_passcode` RPC with room number + passcode
* **Deep-Linking:** URL parameter `?room=XYZ` automatically populates join form for one-click access
* **Lobby Seating:** Supabase Realtime Presence channel manages dynamic seat assignment

---

## 3. Game Rules & Engine Math (`src/core/gameEngine.js`)

### 3.1 Player & Deck Scaling
* **Player Count:** 3 to 8 players
* **Max Cards per Player:** `maxCards = Math.floor(52 / playerCount)`
* **Example Values:** 3 players = 17 cards, 4 players = 13 cards, 5 players = 10 cards, 8 players = 6 cards

### 3.2 Round Mode Sequencing
* **Mountain Mode:** `1 -> maxCards -> 1` — starts at 1 card, increases to max, decreases back to 1. Total rounds: `2 * maxCards - 1`
* **Valley Mode:** `maxCards -> 1 -> maxCards` — starts at max cards, decreases to 1, increases back to max. Total rounds: `2 * maxCards - 1`
* **Flatline Mode:** Constant `maxCards` per round. Total rounds: `maxCards`

### 3.3 Trump Determination Rule
* **Revealed Trump:** Top card of remaining deck after dealing establishes trump suit
* **No Trump (NT):** Only when `cardsCount * playerCount === 52` (all 52 cards dealt, no deck remaining)

### 3.4 Bidding System & "The Hook" Constraint
* **Bidding Order:** Clockwise starting from `initiativeSeat`
* **Forbidden Bid Calculation:** `calculateForbiddenBid(cardsDealt, existingBids) = cardsDealt - sum(existingBids)`
* **The Hook Enforcement:** Final bidder cannot select bid where total bids equal cards dealt. UI disables forbidden bid option.

### 3.5 Trick & Initiative Logic
* **Follow-Suit Validation:** `isValidPlay(hand, playedCard, leadCard)` — player must follow lead suit if possessing it
* **Trick Winner Resolution:** `resolveTrickWinner(trickCards, trumpCard)` — highest trump wins, otherwise highest lead suit wins
* **Initiative Handover:** `initiativeSeat` transfers to winner of previous round's final trick

### 3.6 Exponential Scoring System
* **Successful Contract:** `10 + Bid²` — exact contract fulfillment bonus
* **Failed Contract:** `-(TricksWon - Bid)²` — exponential penalty for missed contract
* **Score Tracking:** Recorded per round in `game_state.scoreHistory`

---

## 4. Implemented MVP UI & UX Features

* **Responsive Layout:** iPhone screen framing with adaptive card positioning
* **Hand Rendering:** Adaptive 14-17 card hand overlap/compression based on card count
* **Bidding Interface:** iOS-style bid wheel drum with smooth scrolling
* **Card Play:** Legal/illegal card highlighting with two-step elevate-and-confirm interaction
* **Trick Review:** 2-second `trickHold` window for completed trick visualization
* **Contract Indicator:** Bilingual Fight/Yield (`搶注` / `讓注`) display
* **Round Transition:** Configurable timer (5-15s or manual) via `game_state.config`
* **Scorecard:** Full match Scorecard modal showing all round history
* **Winner Podium:** Final match results display
* **Sound:** Web Audio sound synthesis for bid placement, card play, and turn notifications

---

## 5. Roadmap / Deferred Scope (Post-MVP)

* **User System:** Login/profiles, account persistence, email/password authentication
* **Localization:** Multi-language switcher (`en_US` / `zh_HK`)
* **Additional Games:** Support for 四十分, 爭上游 card games
* **Server Authority:** Migrate game state transitions to Postgres RPC functions for anti-cheat
* **Bot Takeover:** Dynamic bot seats for disconnected players
* **Voice Chat:** Real-time in-game voice communication