import type { Card, GameState, PlayerId, Rank, Suit, ValidationResult } from './types';

const baseOrder: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const suitIcon: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
};

const getRankValue = (rank: Rank, reversed: boolean): number => {
  if (rank === 'Joker') {
    return 100;
  }
  if (reversed) {
    return 50 - baseOrder.indexOf(rank);
  }
  return baseOrder.indexOf(rank);
};

const isSingleSpadeThree = (cards: Card[]): boolean =>
  cards.length === 1 && cards[0].rank === '3' && cards[0].suit === 'spades';

const hasUniformRank = (cards: Card[]): boolean => {
  if (cards.length <= 1) {
    return true;
  }
  const nonJokers = cards.filter((card) => card.rank !== 'Joker');
  if (nonJokers.length === 0) {
    return cards.every((card) => card.rank === 'Joker');
  }
  const first = nonJokers[0].rank;
  return nonJokers.every((card) => card.rank === first);
};

const countJokers = (cards: Card[]): number => cards.filter((card) => card.rank === 'Joker').length;

const extractSuits = (cards: Card[]): Suit[] =>
  cards
    .filter((card) => card.rank !== 'Joker' && card.suit !== 'joker')
    .map((card) => card.suit as Suit);

const describeLock = (suits: Suit[]): string =>
  suits.map((suit) => suitIcon[suit] ?? suit).join('・');

const satisfiesLock = (cards: Card[], requiredSuits: Suit[]): boolean => {
  if (!requiredSuits.length) {
    return true;
  }
  const suits = extractSuits(cards);
  const jokers = countJokers(cards);
  const missing = requiredSuits.filter((suit) => !suits.includes(suit));
  return missing.length <= jokers;
};

const includesRank = (cards: Card[], rank: Rank): boolean => cards.some((card) => card.rank === rank);

const playerHasCards = (hand: Card[], cards: Card[]): boolean => {
  const handIds = hand.map((card) => card.id);
  return cards.every((card) => handIds.includes(card.id));
};

const compareCombination = (
  challenger: Card[],
  current: Card[],
  reversed: boolean
): number => {
  const challengerStrength = Math.max(...challenger.map((card) => getRankValue(card.rank, reversed)));
  const currentStrength = Math.max(...current.map((card) => getRankValue(card.rank, reversed)));
  return challengerStrength - currentStrength;
};

export const canPlay = (state: GameState, userId: PlayerId, cards: Card[]): ValidationResult => {
  if (state.finished) {
    return { ok: false, reason: '対局は終了しています' };
  }
  if (state.currentTurn !== userId) {
    return { ok: false, reason: '現在はあなたの手番ではありません' };
  }
  const player = state.players.find((item) => item.id === userId);
  if (!player) {
    return { ok: false, reason: 'プレイヤーが見つかりません' };
  }
  if (player.finished) {
    return { ok: false, reason: '既にあがっています' };
  }
  if (cards.length === 0) {
    return { ok: false, reason: 'カードを選択してください' };
  }
  if (!playerHasCards(player.hand, cards)) {
    return { ok: false, reason: '手札に存在しないカードです' };
  }
  if (!hasUniformRank(cards)) {
    return { ok: false, reason: '同じランクのカードのみ出せます' };
  }
  if (state.table.requiredCount !== null && state.table.requiredCount !== cards.length) {
    return { ok: false, reason: `今回は${state.table.requiredCount}枚で出してください` };
  }

  if (!state.flags.awaitingSpade3 && !satisfiesLock(cards, state.flags.lockSuits)) {
    const lockDescription = describeLock(state.flags.lockSuits);
    const requirement =
      state.flags.lockSuits.length === 1
        ? `${lockDescription}のカードを含める必要があります`
        : `${lockDescription}のカードをすべて含める必要があります`;
    return { ok: false, reason: `現在は${requirement}` };
  }

  if (state.flags.awaitingSpade3) {
    if (isSingleSpadeThree(cards)) {
      return { ok: true };
    }
    return { ok: false, reason: 'ジョーカーには♠3のみが返せます' };
  }

  const lastPlay = state.table.lastPlay;
  if (!lastPlay) {
    return { ok: true };
  }

  if (lastPlay.cards.some((card) => card.rank === 'Joker')) {
    if (isSingleSpadeThree(cards)) {
      return { ok: true };
    }
    return { ok: false, reason: 'ジョーカーを超えるカードが必要です' };
  }

  if (includesRank(lastPlay.cards, 'J') && !hasUniformRank(cards)) {
    return { ok: false, reason: '枚数縛りを守ってください' };
  }

  if (cards.length !== lastPlay.cards.length) {
    return { ok: false, reason: `${lastPlay.cards.length}枚で出してください` };
  }

  const diff = compareCombination(cards, lastPlay.cards, state.flags.strengthReversed);
  if (diff <= 0) {
    return { ok: false, reason: 'より強いカードを出す必要があります' };
  }
  return { ok: true };
};
