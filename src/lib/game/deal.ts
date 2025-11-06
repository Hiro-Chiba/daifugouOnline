import { fisherYatesShuffle } from './shuffles';
import type { Card, PlayerId, Rank, Suit } from './types';

const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const ranks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const suitOrder: Record<Suit, number> = {
  clubs: 0,
  diamonds: 1,
  hearts: 2,
  spades: 3
};

const rankOrder: Record<Exclude<Rank, 'Joker'>, number> = {
  '3': 0,
  '4': 1,
  '5': 2,
  '6': 3,
  '7': 4,
  '8': 5,
  '9': 6,
  '10': 7,
  J: 8,
  Q: 9,
  K: 10,
  A: 11,
  '2': 12
};

const createCard = (suit: Suit, rank: Exclude<Rank, 'Joker'>): Card => ({
  id: `${suit}-${rank}`,
  suit,
  rank
});

const createJoker = (): Card => ({
  id: 'joker-joker',
  suit: 'joker',
  rank: 'Joker'
});

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(createCard(suit, rank));
    }
  }
  deck.push(createJoker());
  return deck;
};

export const shuffleDeck = (input: Card[]): Card[] => fisherYatesShuffle(input);

export interface DealResult {
  hands: Record<PlayerId, Card[]>;
  starter: PlayerId | null;
}

export const dealCards = (playerIds: PlayerId[]): DealResult => {
  if (playerIds.length === 0) {
    return { hands: {}, starter: null };
  }
  const deck = shuffleDeck(createDeck());
  const hands: Record<PlayerId, Card[]> = {};
  playerIds.forEach((id) => {
    hands[id] = [];
  });

  deck.forEach((card, index) => {
    const playerIndex = index % playerIds.length;
    const playerId = playerIds[playerIndex];
    hands[playerId].push(card);
  });

  const starter = findStarter(hands);
  return { hands, starter };
};

const compareCard = (a: Card, b: Card): number => {
  if (a.rank === 'Joker') {
    return 1;
  }
  if (b.rank === 'Joker') {
    return -1;
  }
  const rankDiff = rankOrder[a.rank] - rankOrder[b.rank];
  if (rankDiff !== 0) {
    return rankDiff;
  }
  if (a.suit === 'joker' || b.suit === 'joker') {
    return 0;
  }
  return suitOrder[a.suit] - suitOrder[b.suit];
};

const findStarter = (hands: Record<PlayerId, Card[]>): PlayerId | null => {
  let starter: PlayerId | null = null;
  let minCard: Card | null = null;
  for (const [playerId, cards] of Object.entries(hands)) {
    for (const card of cards) {
      if (card.rank === 'Joker') {
        continue;
      }
      if (!minCard || compareCard(card, minCard) < 0) {
        minCard = card;
        starter = playerId;
      }
    }
  }
  return starter;
};
