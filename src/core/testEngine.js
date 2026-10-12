// src/core/testEngine.js
import { 
  createDeck, 
  shuffleDeck, 
  getMaxCardsPerPlayer, 
  calculateForbiddenBid, 
  calculateRoundScore 
} from './gameEngine.js';

console.log('--- RUNNING GAME ENGINE UNIT TESTS ---\n');

// 1. Deck Verification
const deck = createDeck();
console.log(`[Test 1] Deck Size: ${deck.length} cards (Expected: 52)`);
const shuffled = shuffleDeck(deck);
console.log(`[Test 1] Deck Shuffled: ${shuffled[0].rank} of ${shuffled[0].suit}`);

// 2. Max Cards per Player Calculation
console.log(`\n[Test 2] Max Cards per Player:`);
console.log(` - 3 Players: ${getMaxCardsPerPlayer(3)} cards (Expected: 17)`); // 52 / 3 = 17[cite: 7]
console.log(` - 4 Players: ${getMaxCardsPerPlayer(4)} cards (Expected: 13)`); // 52 / 4 = 13[cite: 7]
console.log(` - 5 Players: ${getMaxCardsPerPlayer(5)} cards (Expected: 10)`); // 52 / 5 = 10[cite: 7]

// 3. The Hook (Forbidden Bid) Constraint
// Round with 10 cards dealt. Existing bids: [3, 2, 1] (Sum = 6)
// Forbidden bid for final bidder: 10 - 6 = 4[cite: 5, 7]
const forbidden = calculateForbiddenBid(10, [3, 2, 1]);
console.log(`\n[Test 3] Forbidden Bid Calculation: ${forbidden} (Expected: 4)`);

// 4. Scoring Engine Verification
console.log(`\n[Test 4] Scoring Matrix Verification:`);
const scoreExactZero = calculateRoundScore(0, 0);   // 10 + 0 = 10[cite: 7]
const scoreExactTwo  = calculateRoundScore(2, 2);   // 10 + 4 = 14[cite: 7]
const scoreFailedOver = calculateRoundScore(1, 3);  // -(3-1)^2 = -4[cite: 7]
const scoreFailedBlind = calculateRoundScore(0, 3); // -(3-0)^2 = -9[cite: 7]

console.log(` - Bid 0, Captured 0: ${scoreExactZero} pts (Expected: 10)`);
console.log(` - Bid 2, Captured 2: ${scoreExactTwo} pts (Expected: 14)`);
console.log(` - Bid 1, Captured 3: ${scoreFailedOver} pts (Expected: -4)`);
console.log(` - Bid 0, Captured 3: ${scoreFailedBlind} pts (Expected: -9)`);

console.log('\n--- ALL UNIT TESTS COMPLETED ---');