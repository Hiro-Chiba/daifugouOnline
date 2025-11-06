import type { Card, GameState, PlayerId, Rank, Suit, ValidationResult } from './types';

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

const getNonJokerCards = (cards: Card[]): Card[] => cards.filter((card) => card.rank !== 'Joker');

const hasUniformRank = (cards: Card[]): boolean => {
  const nonJokers = getNonJokerCards(cards);
  if (nonJokers.length <= 1) {
    return true;
  }
  const first = nonJokers[0].rank;
  return nonJokers.every((card) => card.rank === first);
};

const containsJoker = (cards: Card[]): boolean => cards.some((card) => card.rank === 'Joker');

const includesRank = (cards: Card[], rank: Rank): boolean => cards.some((card) => card.rank === rank);

const playerHasCards = (hand: Card[], cards: Card[]): boolean => {
  const handIds = hand.map((card) => card.id);
  return cards.every((card) => handIds.includes(card.id));
};

const extractSuits = (cards: Card[]): Suit[] =>
  cards.filter((card) => card.suit !== 'joker').map((card) => card.suit as Suit);

const describeSuit = (suit: Suit): string => {
  const map: Record<Suit, string> = {
    clubs: '♣',
    diamonds: '♦',
    hearts: '♥',
    spades: '♠'
  };
  return map[suit];
};

const getCombinationRank = (cards: Card[]): Rank => {
  if (cards.length === 0) {
    return '3';
  }
  if (cards.length === 1) {
    return cards[0].rank;
  }
  const nonJokers = getNonJokerCards(cards);
  if (nonJokers.length === 0) {
    return 'Joker';
  }
  return nonJokers[0].rank;
};

const compareCombination = (
  challenger: Card[],
  current: Card[],
  reversed: boolean
): number => {
  const challengerStrength = getRankValue(getCombinationRank(challenger), reversed);
  const currentStrength = getRankValue(getCombinationRank(current), reversed);
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

  if (state.flags.lockSuit) {
    const suits = extractSuits(cards);
    if (suits.length === 0) {
      if (!containsJoker(cards)) {
        return {
          ok: false,
          reason: `${describeSuit(state.flags.lockSuit)}のカードのみ出せます`
        };
      }
    } else if (!suits.every((suit) => suit === state.flags.lockSuit)) {
      return {
        ok: false,
        reason: `${describeSuit(state.flags.lockSuit)}のカードのみ出せます`
      };
    }
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
