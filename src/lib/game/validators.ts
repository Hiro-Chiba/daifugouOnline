import type { Card, GameState, PlayerId, Rank, ValidationResult } from './types';

const baseOrder: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

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

const hasSameRank = (cards: Card[]): boolean => {
  if (cards.length <= 1) {
    return true;
  }
  const first = cards[0].rank;
  return cards.every((card) => card.rank === first);
};

const containsJoker = (cards: Card[]): boolean => cards.some((card) => card.rank === 'Joker');

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
  if (!hasSameRank(cards) && !(cards.length === 1 && containsJoker(cards))) {
    return { ok: false, reason: '同じランクのカードのみ出せます' };
  }
  if (state.table.requiredCount !== null && state.table.requiredCount !== cards.length) {
    return { ok: false, reason: `今回は${state.table.requiredCount}枚で出してください` };
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

  if (includesRank(lastPlay.cards, 'J') && !hasSameRank(cards)) {
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
