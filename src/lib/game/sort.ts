import type { Card, Rank, Suit } from './types';

export type HandSortMode = 'none' | 'strength' | 'suit';

const baseOrder: Exclude<Rank, 'Joker'>[] = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
  '2'
];

const suitOrder: (Suit | 'joker')[] = ['spades', 'hearts', 'diamonds', 'clubs', 'joker'];

const getStrengthValue = (rank: Rank, reversed: boolean): number => {
  if (rank === 'Joker') {
    return Number.POSITIVE_INFINITY;
  }
  const index = baseOrder.indexOf(rank as Exclude<Rank, 'Joker'>);
  if (index === -1) {
    return 0;
  }
  return reversed ? baseOrder.length - index : index;
};

const getSuitValue = (suit: Suit | 'joker'): number => suitOrder.indexOf(suit);

export const sortCardsByStrength = (cards: Card[], reversed: boolean): Card[] => {
  const copy = [...cards];
  copy.sort((a, b) => {
    const strengthDiff = getStrengthValue(b.rank, reversed) - getStrengthValue(a.rank, reversed);
    if (strengthDiff !== 0) {
      return strengthDiff;
    }
    const suitDiff = getSuitValue(b.suit) - getSuitValue(a.suit);
    if (suitDiff !== 0) {
      return suitDiff;
    }
    return a.id.localeCompare(b.id);
  });
  return copy;
};

export const sortCardsBySuit = (cards: Card[], reversed: boolean): Card[] => {
  const copy = [...cards];
  copy.sort((a, b) => {
    const suitDiff = getSuitValue(a.suit) - getSuitValue(b.suit);
    if (suitDiff !== 0) {
      return suitDiff;
    }
    const strengthDiff = getStrengthValue(b.rank, reversed) - getStrengthValue(a.rank, reversed);
    if (strengthDiff !== 0) {
      return strengthDiff;
    }
    return a.id.localeCompare(b.id);
  });
  return copy;
};

export const sortHand = (
  cards: Card[],
  mode: HandSortMode,
  options: { strengthReversed?: boolean } = {}
): Card[] => {
  const reversed = options.strengthReversed ?? false;
  if (mode === 'strength') {
    return sortCardsByStrength(cards, reversed);
  }
  if (mode === 'suit') {
    return sortCardsBySuit(cards, reversed);
  }
  return [...cards];
};
