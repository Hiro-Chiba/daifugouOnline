import { applyEffectAction, applyPass, applyPlay } from '@/lib/game/engine';
import { sortCardsByStrength } from '@/lib/game/sort';
import { canPlay } from '@/lib/game/validators';
import type {
  Card,
  Effect,
  EffectAction,
  GamePlayer,
  GameState,
  Rank
} from '@/lib/game/types';
import type {
  ActiveNpc,
  CardPreference,
  NpcDefinition,
  QueenPreference
} from './types';

const rankOrder: Exclude<Rank, 'Joker'>[] = [
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

const queenRankOptions: Rank[] = [
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

const getRankIndex = (rank: Rank): number => {
  if (rank === 'Joker') {
    return rankOrder.length;
  }
  const index = rankOrder.indexOf(rank);
  return index === -1 ? 0 : index;
};

const getNormalizedRankStrength = (rank: Rank, reversed: boolean): number => {
  if (rank === 'Joker') {
    return 1;
  }
  const index = getRankIndex(rank);
  const normalized = index / (rankOrder.length - 1);
  return reversed ? 1 - normalized : normalized;
};

const getCardStrength = (card: Card, reversed: boolean): number =>
  getNormalizedRankStrength(card.rank, reversed);

const getCombinationStrength = (cards: Card[], reversed: boolean): number => {
  if (!cards.length) {
    return 0;
  }
  const nonJokers = cards.filter((card) => card.rank !== 'Joker');
  if (!nonJokers.length) {
    return 1;
  }
  return getNormalizedRankStrength(nonJokers[0].rank, reversed);
};

const isRevolutionCombination = (cards: Card[]): boolean => {
  if (cards.length === 4) {
    const [first, ...rest] = cards;
    return rest.every((card) => card.rank === first.rank) && !cards.some((card) => card.rank === 'Joker');
  }
  if (cards.length === 5) {
    const jokers = cards.filter((card) => card.rank === 'Joker');
    if (jokers.length !== 1) {
      return false;
    }
    const nonJokers = cards.filter((card) => card.rank !== 'Joker');
    if (nonJokers.length !== 4) {
      return false;
    }
    const [first, ...rest] = nonJokers;
    return rest.every((card) => card.rank === first.rank);
  }
  return false;
};

const getEffectRemaining = (effect: Effect): number => {
  if (!effect.payload) {
    return 0;
  }
  if (typeof effect.payload.remaining === 'number') {
    return effect.payload.remaining;
  }
  if (typeof effect.payload.count === 'number') {
    return effect.payload.count;
  }
  return 0;
};

const findBlockingEffect = (state: GameState, playerId: string): Effect | null => {
  for (const effect of state.pendingEffects) {
    if (!effect.payload || effect.payload.playerId !== playerId) {
      continue;
    }
    if (effect.type === 'sevenGive' || effect.type === 'tenDiscard') {
      return effect;
    }
    if (effect.type === 'queenPurge' && getEffectRemaining(effect) > 0) {
      return effect;
    }
  }
  return null;
};

const combinations = (cards: Card[], size: number): Card[][] => {
  if (size <= 0) {
    return [[]];
  }
  const results: Card[][] = [];
  const helper = (start: number, path: Card[]) => {
    if (path.length === size) {
      results.push([...path]);
      return;
    }
    for (let index = start; index < cards.length; index += 1) {
      path.push(cards[index]);
      helper(index + 1, path);
      path.pop();
    }
  };
  helper(0, []);
  return results;
};

const generatePlayableOptions = (state: GameState, player: GamePlayer): Card[][] => {
  const requiredCount = state.table.requiredCount;
  const hand = player.hand;
  const jokers = hand.filter((card) => card.rank === 'Joker');
  const groups = new Map<Rank, Card[]>();
  for (const card of hand) {
    if (card.rank === 'Joker') {
      continue;
    }
    const group = groups.get(card.rank) ?? [];
    group.push(card);
    groups.set(card.rank, group);
  }
  const baseMax = Array.from(groups.values()).reduce(
    (max, cards) => Math.max(max, cards.length),
    0
  );
  const maxLength = Math.max(1, Math.min(5, Math.max(baseMax + jokers.length, jokers.length)));
  const targetLengths =
    requiredCount !== null
      ? [requiredCount]
      : Array.from({ length: maxLength }, (_, index) => index + 1);
  const seen = new Set<string>();
  const options: Card[][] = [];

  const addOption = (cards: Card[]) => {
    if (!cards.length) {
      return;
    }
    const key = cards
      .map((card) => card.id)
      .sort()
      .join('-');
    if (seen.has(key)) {
      return;
    }
    if (!canPlay(state, player.id, cards).ok) {
      return;
    }
    seen.add(key);
    options.push(cards);
  };

  for (const targetLength of targetLengths) {
    for (const [, cards] of groups) {
      const maxBase = Math.min(cards.length, targetLength);
      for (let baseSize = 1; baseSize <= maxBase; baseSize += 1) {
        const baseCombos = combinations(cards, baseSize);
        for (const base of baseCombos) {
          const neededJokers = targetLength - base.length;
          if (neededJokers < 0) {
            continue;
          }
          if (neededJokers === 0) {
            addOption([...base]);
            continue;
          }
          if (neededJokers <= jokers.length) {
            const jokerCombos = combinations(jokers, neededJokers);
            for (const jokerSet of jokerCombos) {
              addOption([...base, ...jokerSet]);
            }
          }
        }
      }
    }

    if (targetLength <= jokers.length) {
      const jokerCombos = combinations(jokers, targetLength);
      for (const combo of jokerCombos) {
        addOption(combo);
      }
    }
  }

  return options;
};

const averageStrength = (cards: Card[], reversed: boolean): number => {
  if (!cards.length) {
    return 0;
  }
  const total = cards.reduce((sum, card) => sum + getCardStrength(card, reversed), 0);
  return total / cards.length;
};

const chooseEffectCards = (
  hand: Card[],
  limit: number,
  preference: CardPreference,
  reversed: boolean,
  options?: { avoidJoker?: boolean }
): Card[] => {
  if (limit <= 0) {
    return [];
  }
  const avoidJoker = options?.avoidJoker ?? false;
  const pool = avoidJoker ? hand.filter((card) => card.rank !== 'Joker') : [...hand];
  const candidatePool = pool.length >= limit ? pool : [...hand];
  if (!candidatePool.length) {
    return [];
  }
  const descending = sortCardsByStrength(candidatePool, reversed);
  const ascending = [...descending].reverse();
  if (preference === 'highest') {
    return descending.slice(0, Math.min(limit, descending.length));
  }
  if (preference === 'lowest') {
    return ascending.slice(0, Math.min(limit, ascending.length));
  }
  if (candidatePool.length <= limit) {
    return [...candidatePool];
  }
  const start = Math.max(0, Math.floor((ascending.length - limit) / 2));
  return ascending.slice(start, start + limit);
};

const chooseQueenRank = (
  player: GamePlayer,
  preference: QueenPreference,
  declared: Set<Rank>,
  reversed: boolean
): Rank => {
  const available = queenRankOptions.filter((rank) => !declared.has(rank));
  if (!available.length) {
    return '3';
  }
  const counts = new Map<Rank, number>();
  for (const rank of available) {
    counts.set(
      rank,
      player.hand.filter((card) => card.rank === rank).length
    );
  }
  const strength = (rank: Rank) => getNormalizedRankStrength(rank, reversed);

  if (preference === 'rarest') {
    return available.reduce((best, rank) => {
      const currentCount = counts.get(rank) ?? 0;
      const bestCount = counts.get(best) ?? Number.POSITIVE_INFINITY;
      if (currentCount === bestCount) {
        return strength(rank) > strength(best) ? rank : best;
      }
      return currentCount < bestCount ? rank : best;
    }, available[0]);
  }

  if (preference === 'common') {
    return available.reduce((best, rank) => {
      const currentCount = counts.get(rank) ?? 0;
      const bestCount = counts.get(best) ?? -1;
      if (currentCount === bestCount) {
        return strength(rank) > strength(best) ? rank : best;
      }
      return currentCount > bestCount ? rank : best;
    }, available[0]);
  }

  return available.reduce((best, rank) => {
    const bestStrength = strength(best);
    const currentStrength = strength(rank);
    if (currentStrength === bestStrength) {
      const bestCount = counts.get(best) ?? 0;
      const currentCount = counts.get(rank) ?? 0;
      return currentCount < bestCount ? rank : best;
    }
    return currentStrength > bestStrength ? rank : best;
  }, available[0]);
};

const decideEffectAction = (
  state: GameState,
  player: GamePlayer,
  definition: NpcDefinition
): EffectAction | null => {
  const effect = findBlockingEffect(state, player.id);
  if (!effect) {
    return null;
  }
  const reversed = state.flags.strengthReversed;
  const usage = definition.strategy.optionalEffectUsage;
  if (effect.type === 'sevenGive' || effect.type === 'tenDiscard') {
    const limit = Math.max(0, typeof effect.payload?.count === 'number' ? effect.payload.count : 0);
    const preference =
      effect.type === 'sevenGive'
        ? definition.strategy.effectPreferences.sevenGive
        : definition.strategy.effectPreferences.tenDiscard;
    const selectedCards = chooseEffectCards(
      player.hand,
      limit,
      preference,
      reversed,
      effect.type === 'sevenGive' ? { avoidJoker: true } : undefined
    ).slice(0, limit);
    if (effect.payload?.optional) {
      const bias = effect.type === 'sevenGive' ? usage.sevenGive : usage.tenDiscard;
      const probability = Math.min(0.95, Math.max(0.05, bias + averageStrength(selectedCards, reversed) * 0.25));
      if (!selectedCards.length || Math.random() > probability) {
        return { type: effect.type, playerId: player.id, cards: [] };
      }
    }
    return { type: effect.type, playerId: player.id, cards: selectedCards.map((card) => card.id) };
  }

  if (effect.type === 'queenPurge') {
    const declared = new Set(effect.payload?.declaredRanks ?? []);
    const rank = chooseQueenRank(
      player,
      definition.strategy.effectPreferences.queenPurge,
      declared,
      reversed
    );
    return { type: 'queenPurge', playerId: player.id, rank };
  }

  return null;
};

const evaluatePlayOption = (
  cards: Card[],
  state: GameState,
  player: GamePlayer,
  definition: NpcDefinition
): number => {
  const reversed = state.flags.strengthReversed;
  const weights = definition.strategy.weights;
  const effectWeights = definition.strategy.effectWeights;
  const lastPlay = state.table.lastPlay;
  const responding = Boolean(lastPlay && lastPlay.playerId !== player.id);
  const strength = getCombinationStrength(cards, reversed);
  const cardCount = cards.length;
  const cardsRemaining = player.hand.length - cardCount;
  const finishes = cardsRemaining <= 0;
  const nearFinish = !finishes && cardsRemaining <= 2;
  const hasRank = (rank: Rank) => cards.some((card) => card.rank === rank);
  const hasJoker = cards.some((card) => card.rank === 'Joker');
  const usesSpadeThree = cards.some(
    (card) => card.rank === '3' && card.suit === 'spades'
  );
  const keepTurn = hasRank('8') || (state.flags.awaitingSpade3 && usesSpadeThree);
  const lastStrength = lastPlay ? getCombinationStrength(lastPlay.cards, reversed) : 0;

  let score = weights.base;

  score += weights.aggression * strength;
  if (!responding) {
    score -= weights.conserveHigh * strength;
  } else {
    score -= weights.conserveHigh * strength * 0.3;
  }
  score += weights.lowCardBias * (1 - strength);
  score += weights.combo * ((cardCount - 1) / 3);

  if (keepTurn) {
    score += weights.keepTurn;
  }
  if (isRevolutionCombination(cards)) {
    score += weights.revolution;
  }
  if (finishes) {
    score += weights.finish;
  } else if (nearFinish) {
    score += weights.finish * 0.5;
  }

  if (responding) {
    score += weights.respondPressure * (strength - lastStrength + 0.1);
  } else {
    score += weights.openingInitiative * (1 - strength);
  }

  if (state.flags.awaitingSpade3 && usesSpadeThree) {
    score += weights.counterBonus;
  }

  if (hasRank('8')) {
    score += effectWeights.eightCut;
  }
  if (hasRank('10')) {
    score += effectWeights.tenDiscard;
  }
  if (hasRank('7')) {
    score += effectWeights.sevenGive;
  }
  if (hasRank('Q')) {
    score += effectWeights.queenPurge;
  }
  if (hasRank('J')) {
    score += effectWeights.jackReverse;
  }
  if (hasRank('9')) {
    score += effectWeights.nineReverse;
  }
  if (hasJoker) {
    score += effectWeights.joker;
    if (!finishes) {
      score -= weights.holdJoker;
    }
  }

  if (lastPlay && lastPlay.playerId === player.id) {
    score += weights.keepTurn * 0.2;
  }

  score += (Math.random() - 0.5) * weights.randomness;

  return score;
};

export const executeNpcTurn = (state: GameState, npc: ActiveNpc): GameState => {
  const player = state.players.find((item) => item.id === npc.playerId);
  if (!player || player.finished) {
    return state;
  }

  const effectAction = decideEffectAction(state, player, npc.definition);
  if (effectAction) {
    const { state: nextState, result } = applyEffectAction(state, effectAction);
    if (result.ok) {
      return nextState;
    }
    if (effectAction.type === 'sevenGive' || effectAction.type === 'tenDiscard') {
      const fallback: EffectAction = { type: effectAction.type, playerId: player.id, cards: [] };
      return applyEffectAction(state, fallback).state;
    }
    if (effectAction.type === 'queenPurge') {
      const declared = new Set(
        findBlockingEffect(state, player.id)?.payload?.declaredRanks ?? []
      );
      const rank = chooseQueenRank(
        player,
        npc.definition.strategy.effectPreferences.queenPurge,
        declared,
        state.flags.strengthReversed
      );
      return applyEffectAction(state, { type: 'queenPurge', playerId: player.id, rank }).state;
    }
    return state;
  }

  if (state.currentTurn !== player.id) {
    return state;
  }

  const options = generatePlayableOptions(state, player);
  if (!options.length) {
    return applyPass(state, player.id);
  }

  let bestCards: Card[] | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const option of options) {
    const score = evaluatePlayOption(option, state, player, npc.definition);
    if (score > bestScore) {
      bestScore = score;
      bestCards = option;
    }
  }

  if (!bestCards || bestScore <= npc.definition.strategy.thresholds.pass) {
    return applyPass(state, player.id);
  }

  const { state: nextState, result } = applyPlay(state, player.id, bestCards);
  if (!result.ok) {
    return applyPass(state, player.id);
  }
  return nextState;
};
