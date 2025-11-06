import type { Card } from './types';

export const fisherYatesShuffle = (cards: Card[], seed?: number): Card[] => {
  const deck = [...cards];
  let randomSeed = seed ?? Date.now();
  const random = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  };
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor((seed === undefined ? Math.random() : random()) * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
};
