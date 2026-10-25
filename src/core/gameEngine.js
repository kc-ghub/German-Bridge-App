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
 * Calculates max cards per player (supports both number count or players array)
 */
export const getMaxCardsPerPlayer = (playersOrCount) => {
  const count = typeof playersOrCount === 'number' 
    ? playersOrCount 
    : (Array.isArray(playersOrCount) ? playersOrCount.length : 4);
  return Math.floor(52 / count);
};

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

/**
 * 6. Round Card Sequencer
 * Mountain: Starts at maxCards, decreases to 1, increases back to maxCards[cite: 2].
 * Valley: Starts at 1, increases to maxCards, decreases back to 1[cite: 2].
 * Flatline: Stays at maxCards[cite: 2].
 */
export const getRoundCardsCount = (mode, roundNumber, maxCards) => {
  if (mode === 'flatline') return maxCards;

  if (mode === 'mountain') {
    if (roundNumber <= maxCards) {
      return roundNumber;
    } else {
      return (2 * maxCards) - roundNumber;
    }
  }

  if (mode === 'valley') {
    if (roundNumber <= maxCards) {
      return maxCards - (roundNumber - 1);
    } else {
      return 1 + (roundNumber - maxCards);
    }
  }

  return maxCards;
};

export const getTotalRounds = (mode, maxCards) => {
  if (mode === 'mountain' || mode === 'valley') {
    return (2 * maxCards) - 1;
  }
  // flatline
  return maxCards;
};

/**
 * Deal Round Execution
 * Accepts either a player count (e.g. 4) or a players array.
 * Returns: { hands: [hand1, hand2, ...], trumpCard, isNoTrump }
 */
export const dealRound = (playersOrCount, cardsCount) => {
  const count = typeof playersOrCount === 'number' 
    ? playersOrCount 
    : (Array.isArray(playersOrCount) ? playersOrCount.length : 4);

  const deck = shuffleDeck(createDeck());
  const hands = [];
  for (let i = 0; i < count; i++) {
    const hand = deck.splice(0, cardsCount);
    hands.push(sortHand(hand));
  }
  const isNoTrump = (cardsCount * count === 52);
  const trumpCard = isNoTrump ? null : deck[0];
  return { hands, trumpCard, isNoTrump };
};

/**
 * 8. Hand Sorting
 * Groups cards by suit and sorts descending by value (Ace = 14 to 2 = 2).
 */
export const sortHand = (hand = []) => {
  const suitOrder = { Spades: 1, Hearts: 2, Clubs: 3, Diamonds: 4 };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.value - a.value;
  });
};

/**
 * 9. Clockwise Seat Rotator
 * Given a current seat number (1-based) and total player count,
 * returns the next seat in clockwise order.
 */
export const getNextSeat = (currentSeat, totalPlayers) => {
  return (currentSeat % totalPlayers) + 1;
};

/**
 * 10. Check Last Bidder (The Dealer / Hook Holder)
 * Given the total players and the number of already committed bids,
 * returns true if the current bidder is the final bidder for the round.
 */
export const isFinalBidder = (totalPlayers, committedBidsCount) => {
  return committedBidsCount === totalPlayers - 1;
};

/**
 * 11. Follow-Suit Validation
 * Ensures the player follows the lead suit if they possess it.
 */
export const isValidPlay = (hand, playedCard, leadCard) => {
  if (!leadCard) return true; // First player to lead can play any card
  
  const hasLeadSuit = hand.some(c => c.suit === leadCard.suit);
  if (hasLeadSuit && playedCard.suit !== leadCard.suit) {
    return false; // Player has the lead suit but didn't play it
  }
  
  return true; // Valid play (followed suit, or void in lead suit)
};

/**
 * 12. Trick Winner Evaluation
 * Evaluates an array of played cards and returns the user_id of the winner.
 * trickCards format: [{ user_id: 'uuid', card: { suit, value, rank } }, ...]
 */
export const resolveTrickWinner = (trickCards, trumpCard) => {
  if (!trickCards || trickCards.length === 0) return null;

  const leadSuit = trickCards[0].card.suit;
  const trumpSuit = trumpCard ? trumpCard.suit : null;

  let winningPlay = trickCards[0];

  for (let i = 1; i < trickCards.length; i++) {
    const currentPlay = trickCards[i];
    const currentCard = currentPlay.card;
    const winningCard = winningPlay.card;

    const isCurrentTrump = currentCard.suit === trumpSuit;
    const isWinningTrump = winningCard.suit === trumpSuit;

    if (isCurrentTrump && !isWinningTrump) {
      // First trump played wins immediately against non-trumps
      winningPlay = currentPlay;
    } else if (isCurrentTrump && isWinningTrump) {
      // Higher trump beats lower trump
      if (currentCard.value > winningCard.value) winningPlay = currentPlay;
    } else if (currentCard.suit === leadSuit && !isWinningTrump) {
      // Higher lead suit beats lower lead suit (if no trumps have been played)
      if (currentCard.value > winningCard.value) winningPlay = currentPlay;
    }
  }

  return winningPlay.user_id;
};