import type { Card, Rank, Suit } from './types';

const faceCardFileNames: Partial<Record<Exclude<Rank, 'Joker'>, string>> = {
  J: 'jack',
  Q: 'queen',
  K: 'king',
  A: 'ace'
};

const suitSymbols: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
};

const getRankFileName = (rank: Exclude<Rank, 'Joker'>): string =>
  faceCardFileNames[rank] ?? rank;

export const getCardImagePath = (card: Card): string => {
  if (card.rank === 'Joker') {
    return '/cards/black_joker.png';
  }
  const rankFile = getRankFileName(card.rank);
  return `/cards/${rankFile}_of_${card.suit}.png`;
};

export const getCardLabel = (card: Card): string => {
  if (card.rank === 'Joker') {
    return 'ジョーカー';
  }
  const suitSymbol = card.suit === 'joker' ? '' : suitSymbols[card.suit as Suit];
  return `${suitSymbol}${card.rank}`;
};
