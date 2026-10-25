import { 
  createDeck, 
  shuffleDeck, 
  getMaxCardsPerPlayer, 
  calculateForbiddenBid, 
  calculateRoundScore,
  dealRound,
  getRoundCardsCount,
  getTotalRounds,
  sortHand
} from './gameEngine.js';

console.log('--- RUNNING GAME ENGINE UNIT TESTS ---\n');

// 1. Deck Verification
const deck = createDeck();
console.log(`[Test 1] Deck Size: ${deck.length} cards (Expected: 52)`);
const shuffled = shuffleDeck(deck);
console.log(`[Test 1] Deck Shuffled: ${shuffled[0].rank} of ${shuffled[0].suit}`);

// 2. Max Cards per Player Calculation
console.log(`\n[Test 2] Max Cards per Player:`);
console.log(` - 3 Players: ${getMaxCardsPerPlayer(3)} cards (Expected: 17)`);
console.log(` - 4 Players: ${getMaxCardsPerPlayer(4)} cards (Expected: 13)`);
console.log(` - 5 Players: ${getMaxCardsPerPlayer(5)} cards (Expected: 10)`);

// 3. The Hook (Forbidden Bid) Constraint
const forbidden = calculateForbiddenBid(10, [3, 2, 1]);
console.log(`\n[Test 3] Forbidden Bid Calculation: ${forbidden} (Expected: 4)`);

// 4. Scoring Engine Verification
console.log(`\n[Test 4] Scoring Matrix Verification:`);
console.log(` - Bid 0, Captured 0: ${calculateRoundScore(0, 0)} pts (Expected: 10)`);
console.log(` - Bid 2, Captured 2: ${calculateRoundScore(2, 2)} pts (Expected: 14)`);
console.log(` - Bid 1, Captured 3: ${calculateRoundScore(1, 3)} pts (Expected: -4)`);
console.log(` - Bid 0, Captured 3: ${calculateRoundScore(0, 3)} pts (Expected: -9)`);

console.log('\n--- VERIFYING PHASE 4A ENGINE EXPANSIONS ---');

// 5. Total Rounds Verification
const totalM = getTotalRounds('mountain', 13);
const totalV = getTotalRounds('valley', 13);
const totalF = getTotalRounds('flatline', 13);
console.log(`[Test 5A] Total Rounds: Mountain=${totalM} (Exp: 25), Valley=${totalV} (Exp: 25), Flatline=${totalF} (Exp: 13)`);

// 5B. Card Counts Progression
const mR1 = getRoundCardsCount('mountain', 1, 13);
const mR13 = getRoundCardsCount('mountain', 13, 13);
const mR25 = getRoundCardsCount('mountain', 25, 13);
console.log(`[Test 5B] Mountain Cards: R1=${mR1} (Exp: 1), R13=${mR13} (Exp: 13), R25=${mR25} (Exp: 1)`);

const vR1 = getRoundCardsCount('valley', 1, 13);
const vR13 = getRoundCardsCount('valley', 13, 13);
const vR25 = getRoundCardsCount('valley', 25, 13);
console.log(`[Test 5C] Valley Cards: R1=${vR1} (Exp: 13), R13=${vR13} (Exp: 1), R25=${vR25} (Exp: 13)`);

// 6. Round 1 Deal (Mountain: 1 card per player)
const dummyPlayers = [
  { user_id: 'u1', seat_number: 1 },
  { user_id: 'u2', seat_number: 2 },
  { user_id: 'u3', seat_number: 3 },
  { user_id: 'u4', seat_number: 4 },
];
const dealRes = dealRound(dummyPlayers, 1, 1);
console.log(`[Test 6] 4-Player R1 Hand Count: ${dealRes.hands['u1'].length} card (Expected: 1)`);
console.log(`[Test 6] 4-Player R1 Trump: ${dealRes.isNoTrump ? 'NO TRUMP (NT)' : `${dealRes.trumpCard.rank} of ${dealRes.trumpCard.suit}`} (Expected: Revealed Trump Card)`);

// 7. Hand sort check
const sorted = sortHand(dealRes.hands['u1']);
console.log(`[Test 7] Sorted hand card: ${sorted[0].rank} of ${sorted[0].suit}`);
console.log('--- PHASE 4A ENGINE TESTS COMPLETED ---\n');