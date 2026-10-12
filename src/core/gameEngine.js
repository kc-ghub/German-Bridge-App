// src/core/gameEngine.js
// Decoupled Core Game Engine for German Bridge

export const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 1. Creates a standard 52-card deck (no Jokers)
 */
export const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (let rankIndex = 0; rankIndex < RANKS.length; rankIndex++) {
      deck.push({ 
        suit, 
        rank: RANKS[rankIndex], 
        value: rankIndex + 2 // 2=2 through Ace=14
      });
    }
  }
  return deck;
};

/**
 * 2. Fisher-Yates Deck Shuffling Algorithm
 */
export const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * 3. Max Cards Per Player Math
 * Calculates Math.floor(52 / playerCount)
 */
export const getMaxCardsPerPlayer = (playerCount) => Math.floor(52 / playerCount);

/**
 * 4. Bidding Engine: "The Hook" Constraint
 * The final bidder cannot select a bid where total bids equal total cards dealt.
 */
export const calculateForbiddenBid = (cardsDealt, existingBids) => {
  const sumOfBids = existingBids.reduce((acc, bid) => acc + bid, 0);
  const forbidden = cardsDealt - sumOfBids;
  return forbidden >= 0 ? forbidden : -1;
};

/**
 * 5. Exponential Scoring Engine
 * Success: 10 + (Bid^2)
 * Failure: -((Tricks - Bid)^2)
 */
export const calculateRoundScore = (bid, tricksCaptured) => {
  if (bid === tricksCaptured) {
    return 10 + Math.pow(bid, 2);
  } else {
    const diff = tricksCaptured - bid;
    return -Math.pow(diff, 2);
  }
};