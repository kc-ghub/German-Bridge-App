# Technical Game Specifications: German Bridge (德國橋牌)

## 1. Core Architecture and Setup Math

### 1.1 Components and State Arrays
* **Deck:** Standard 52-card deck (No Jokers). 
* **Card Ranks:** Ace, King, Queen, Jack, 10, 9, 8, 7, 6, 5, 4, 3, 2 (Ace is always high).
* **Suits:** Spades, Hearts, Diamonds, Clubs.

### 1.2 Room Type Constraints and Scaling
The maximum cards dealt per player and the player capacities depend heavily on the type of desk created:

#### Public Desks (Streamlined Matchmaking)
* **Player Capacity:** Permanently locked to exactly 4 players.
* **Maximum Cards per Player:** Fixed at 13 cards.
* **Remaining Deck Cards:** 0 cards.
* **Trump Suit Override:** No Trump (NT) is automatically enforced for all rounds.

#### Private Desks (Custom Friend Play)
* **Player Capacity:** Configurable from a minimum of 3 players to a maximum of 8 players.
* **Maximum Cards per Player:** Dynamically calculated using the formula: Round Down (52 / Number of Players).
* **Trump Suit Protocol:** If cards remain in the deck after dealing, the top card of the remainder pile is flipped face-up to establish the Trump suit. If 0 cards remain (such as 4 players playing 13 cards), No Trump is enforced.

---

## 2. Game Sequence and State Machine

### 2.1 Round Sequencer Configurations
The system handles round sequencing rules based on the room type:

* **Public Desks:** Mode 3 (The Flatline) is completely disabled. When all 4 players hit the "Ready" button, the system executes an automated 50/50 random selection to launch the match using either Mode 1 (The Valley) or Mode 2 (The Mountain).
* **Private Desks:** The room host has complete manual control to select any of the three operational modes before launching the lobby.

#### Mode 1: The Valley (Up and Down)
* **Sequence:** Starts at 1 card, increases by 1 card each round up to the Maximum Cards per player, then decreases by 1 card each round back down to 1 card.
* **Total Rounds:** (Maximum Cards * 2) - 1

#### Mode 2: The Mountain (Down and Up)
* **Sequence:** Starts at the Maximum Cards per player, decreases by 1 card each round down to 1 card, then increases by 1 card each round back up to the Maximum Cards.
* **Total Rounds:** (Maximum Cards * 2) - 1

#### Mode 3: The Flatline (Constant Deals - Private Only)
* **Sequence:** Hand sizes remain frozen at the Maximum Cards per player for a user-defined number of rounds.

### 2.2 Initiative Engine (Dealing, Bidding, and Leading Order)
* **Round 1 Initial State:** The system executes a random selection to pick exactly 1 player as the Initiative Holder. 
* **Subsequent Rounds State:** The Initiative Holder status is passed exclusively to the Last Winner (the specific individual who won the final trick of the immediate past round). 
* **Execution Flow for Initiative Holder:**
  1. **Deal Order:** The automated deal engine starts dealing cards to the Initiative Holder first, moving clockwise.
  2. **First Bidder:** The Bidding Phase opens with the Initiative Holder.
  3. **First Lead:** The Trick-Taking Phase begins with the Initiative Holder throwing the first card.

---

## 3. Play Phase Logic

### 3.1 The Bidding Phase and "The Hook" Constraint
Bidding operates clockwise from the Initiative Holder. 

When the rotation reaches the final player (the player immediately to the right of the Initiative Holder, effectively the Dealer), the system calculates the Forbidden Bid.

* **Formula:** Forbidden Bid = Total Cards Dealt in Current Round - Sum of All Previous Bids

* **UI Engine Constraint:** If the Forbidden Bid is 0 or a positive number, the corresponding selection button must be disabled and grayed out on the final bidder's interface. The sum of all bids is strictly not allowed to equal the total cards dealt in the round.

### 3.2 Trick-Taking Engine (Follow Suit Rules)
A round consists of a number of individual tricks equal to the cards dealt in that round.
1. **Led Card:** The trick starter plays a card. Its suit is assigned as the Led Suit.
2. **Validation Engine:** Moving clockwise, the system evaluates the remaining players' cards:
   * **Condition A (Has Suit):** If a player possesses cards matching the Led Suit, the interface must lock all other suits. The player must follow suit.
   * **Condition B (Void in Suit):** If a player possesses 0 cards of the Led Suit, the validation engine unlocks their entire hand. They may play any card—either discarding an alternative suit or throwing a card of the Trump Suit.

### 3.3 Trick Resolution and Winner Evaluation
Once all players have contributed 1 card to the trick pool:
* **Case 1 (Trump Present):** If any cards matching the active Trump Suit exist in the pool, the trick is won by the player who threw the highest rank Trump card. 
* **Case 2 (No Trump Present / NT Round):** The trick is won by the player who threw the highest rank card matching the Led Suit. Alternate suits thrown due to Condition B are disregarded in evaluation.

The system adds 1 to the winner's "Tricks Won" count for that round. The winner leads the immediate next trick.

---

## 4. Scoring Logic (The Exponential System)

At the conclusion of a round (after all tricks are settled), the system compares each player's Bid against their actual Tricks Won. Cumulative leaderboards are updated using the formulas below.

### 4.1 Successful Contract (Tricks Won equals Bid)
The player receives a 10-point baseline plus the square of their bid:
* **Formula:** Round Score = 10 + (Bid * Bid)

### 4.2 Failed Contract (Tricks Won does not equal Bid)
The player receives 0 baseline points and suffers an exponential penalty subtracted from their total score based on the square of the difference:
* **Formula:** Round Score = - ( (Tricks Won - Bid) * (Tricks Won - Bid) )

### 4.3 Reference Math Verification Table for Unit Testing

| Target Bid | Tricks Captured | Outcome | Mathematical Formula | Points Awarded or Deducted |
| :---: | :---: | :---: | :--- | :---: |
| 0 | 0 | Success | 10 + (0 * 0) | +10 |
| 2 | 2 | Success | 10 + (2 * 2) | +14 |
| 5 | 5 | Success | 10 + (5 * 5) | +35 |
| 1 | 3 | Over-tricked | - ((3 - 1) * (3 - 1)) | -4 |
| 1 | 2 | Over-tricked | - ((2 - 1) * (2 - 1)) | -1 |
| 3 | 2 | Under-tricked | - ((2 - 3) * (2 - 3)) | -1 |
| 2 | 4 | Over-tricked | - ((4 - 2) * (4 - 2)) | -4 |
| 0 | 3 | Broken Blind | - ((3 - 0) * (3 - 0)) | -9 |

---

## 5. Network Architecture and Lobby Features

### 5.1 Room Modes and Matchmaking

#### Mode A: Private Rooms (Friend Play)
* **Creation:** Any player can host a private room and choose their preferred player limits and round configurations. The system instantly generates a unique 4-to-6 alphanumeric Game ID.
* **Manual Joining:** Players can open the app, tap "Join Private Room," and type the unique Game ID directly into an input prompt.
* **Deep-Link Invitation:** Alternatively, the host can tap a "Share" button to broadcast an automated deep-link URL (e.g., germanbridge://room/ABCD) via messaging networks (WhatsApp, WeChat, Signal, Email, etc.). Clicking this link automatically opens the app and injects the player directly into the specific private lobby.

#### Mode B: Public Rooms (The "Game Desk" System)
* **The Lobby Browser:** A public noticeboard displaying open "Game Desks," strictly capped at 4 player slots to maximize queue efficiency.
* **Desk Metadata:** Displays Host Name, Current Player Count (e.g., 1/4, 3/4), and Entry Restrictions (Skill Level requirement).
* **Game Initiation:** Players freely select open desks. Once the lobby reaches 4/4 status and all participants flag themselves as "Ready," the system randomly selects Valley or Mountain mode and launches the match immediately.

### 5.2 Session Resilience (Disconnection and Idle Logic)
* **The Timer:** Every player gets a 15-second countdown timer to place their bid or play a card.
* **Going Idle:** If the timer hits 0, or if the server detects the player closed their browser/app, the app flags that player as "Offline."
* **AI Takeover:** The backend instantly activates a Bot Player to take over their hand seamlessly using a conservative, safe tactic.
* **Reconnection:** If the human player returns, they are automatically resynced to the table, and the bot actor is destroyed.

---

## 6. User Identity, Localizations, and Voice Chat

### 6.1 Avatar System
* Graphic Theme: Nostalgic 1990s Hong Kong student life (e.g., retro dynamic spectacles, instant noodle bowls, classic宿舍/hall green lamps, mahjong tiles, and graduation caps).

### 6.2 Player Nickname Validation and Moderation
* Character Length Constraint: Minimum 2 characters, maximum 12 characters.
* Content Moderation Filter: The system checks strings against an English and Cantonese/Hong Kong local slang vulgarity regex array.

### 6.3 Multi-Lingual Architecture
* Separate JSON translation files (e.g., zh_HK.json and en_US.json). Traditional Chinese utilizes authentic localized terms like 搶棟, 報棟, and 爆大冧巴.

### 6.4 Real-Time In-Game Voice Communication
* **Voice Engine:** Integrated via a third-party SDK (e.g., Agora.io). It automatically provisions isolated voice channels mapped directly to the active Game ID.