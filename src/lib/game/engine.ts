import { format } from 'date-fns';
import { dealCards } from './deal';
import { MIN_PLAYERS } from './constants';
import { canPlay } from './validators';
import type {
  Card,
  EffectAction,
  Effect,
  GamePlayer,
  GameState,
  PlayerId,
  Play,
  PublicState,
  ValidationResult,
  Rank,
  Suit
} from './types';

const describeCards = (cards: Card[]): string =>
  cards
    .map((card) => {
      if (card.rank === 'Joker') {
        return 'ジョーカー';
      }
      const suitIcon: Record<string, string> = {
        clubs: '♣',
        diamonds: '♦',
        hearts: '♥',
        spades: '♠'
      };
      return `${suitIcon[card.suit] ?? ''}${card.rank}`;
    })
    .join(' ');

const suitIconMap: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
};

const countByRank = (cards: Card[], rank: Rank): number =>
  cards.filter((card) => card.rank === rank).length;

const countJokers = (cards: Card[]): number => countByRank(cards, 'Joker');

const getNonJokerCards = (cards: Card[]): Card[] =>
  cards.filter((card) => card.rank !== 'Joker');

const isRevolutionPlay = (cards: Card[]): boolean => {
  if (cards.length === 4) {
    const [first, ...rest] = cards;
    return rest.every((card) => card.rank === first.rank) && countJokers(cards) === 0;
  }
  if (cards.length === 5) {
    const jokerCount = countJokers(cards);
    if (jokerCount !== 1) {
      return false;
    }
    const nonJokers = getNonJokerCards(cards);
    if (nonJokers.length !== 4) {
      return false;
    }
    const [first, ...rest] = nonJokers;
    return rest.every((card) => card.rank === first.rank);
  }
  return false;
};

const syncStrengthReversalState = (state: GameState) => {
  state.flags.strengthReversed = state.flags.revolutionActive !== state.flags.jackReversalActive;
};

const getEffectiveCountForRank = (cards: Card[], rank: Rank): number => {
  const rankCount = countByRank(cards, rank);
  if (rankCount === 0) {
    return 0;
  }
  const jokerCount = countJokers(cards);
  if (jokerCount === 0) {
    return rankCount;
  }
  if (jokerCount === 1 && rankCount >= 1 && rankCount <= 3) {
    return Math.max(rankCount, 3);
  }
  return rankCount;
};

const getNonJokerSuits = (cards: Card[]): Suit[] =>
  cards.filter((card) => card.suit !== 'joker').map((card) => card.suit as Suit);

const getEffectRemaining = (effect: Effect): number => {
  const payload = effect.payload;
  if (!payload) {
    return 0;
  }
  if (typeof payload.remaining === 'number') {
    return payload.remaining;
  }
  if (typeof payload.count === 'number') {
    return payload.count;
  }
  return 0;
};

const isBlockingEffectForPlayer = (effect: Effect, playerId: PlayerId): boolean => {
  if (!effect.payload || effect.payload.playerId !== playerId) {
    return false;
  }
  if (effect.type === 'sevenGive' || effect.type === 'tenDiscard') {
    return true;
  }
  if (effect.type === 'queenPurge') {
    return getEffectRemaining(effect) > 0;
  }
  return false;
};

const cloneState = (state: GameState): GameState => ({
  roomCode: state.roomCode,
  players: state.players.map((player) => ({
    ...player,
    hand: [...player.hand]
  })),
  currentTurn: state.currentTurn,
  startingPlayer: state.startingPlayer,
  flags: { ...state.flags },
  table: {
    lastPlay: state.table.lastPlay
      ? {
          playerId: state.table.lastPlay.playerId,
          cards: [...state.table.lastPlay.cards],
          timestamp: state.table.lastPlay.timestamp
        }
      : null,
    requiredCount: state.table.requiredCount,
    pile: [...state.table.pile],
    logs: [...state.table.logs]
  },
  pendingEffects: state.pendingEffects.map((effect) => ({
    type: effect.type,
    payload: effect.payload ? { ...effect.payload } : undefined
  })),
  turnHistory: state.turnHistory.map((play) => ({
    playerId: play.playerId,
    cards: [...play.cards],
    timestamp: play.timestamp
  })),
  finished: state.finished,
  passStreak: state.passStreak,
  matchId: state.matchId
});

export const createEmptyState = (roomCode: string): GameState => ({
  roomCode,
  players: [],
  currentTurn: null,
  startingPlayer: null,
  flags: {
    strengthReversed: false,
    revolutionActive: false,
    jackReversalActive: false,
    rotationReversed: false,
    lockSuit: null,
    awaitingSpade3: false
  },
  table: {
    lastPlay: null,
    requiredCount: null,
    pile: [],
    logs: []
  },
  pendingEffects: [],
  turnHistory: [],
  finished: false,
  passStreak: 0,
  matchId: null
});

const updatePlayerHand = (player: GamePlayer, cards: Card[]): GamePlayer => {
  const ids = new Set(cards.map((card) => card.id));
  return {
    ...player,
    hand: player.hand.filter((card) => !ids.has(card.id)),
    hasPassed: false
  };
};

const calculateNextPlayer = (state: GameState, currentPlayerId: PlayerId, keepTurn: boolean): PlayerId | null => {
  if (state.finished) {
    return null;
  }
  if (keepTurn) {
    return currentPlayerId;
  }
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  const currentIndex = ordered.findIndex((player) => player.id === currentPlayerId);
  if (currentIndex === -1) {
    return null;
  }
  const direction = state.flags.rotationReversed ? -1 : 1;
  const total = ordered.length;
  let index = currentIndex;
  for (let i = 0; i < total; i += 1) {
    index = (index + direction + total) % total;
    const candidate = ordered[index];
    if (!candidate.finished) {
      return candidate.id;
    }
  }
  return null;
};

const appendLog = (state: GameState, message: string) => {
  state.table.logs.push(`${format(new Date(), 'HH:mm:ss')} ${message}`);
  if (state.table.logs.length > 50) {
    state.table.logs = state.table.logs.slice(-50);
  }
};

const assignResultLabel = (state: GameState, playerId: PlayerId) => {
  const finishCount = state.players.filter((player) => player.result && player.id !== playerId).length;
  const labels = ['大富豪', '富豪', '平民', '貧民', '大貧民'];
  const player = state.players.find((item) => item.id === playerId);
  if (!player) {
    return;
  }
  const label = labels[finishCount] ?? '平民';
  player.result = label;
};

const completePlayerIfOutOfCards = (state: GameState, player: GamePlayer) => {
  if (!player.finished && player.hand.length === 0) {
    player.finished = true;
    appendLog(state, `${player.name} があがりました！`);
    assignResultLabel(state, player.id);
  }
};

const checkForMatchEnd = (state: GameState) => {
  const remaining = state.players.filter((player) => !player.finished);
  if (remaining.length <= 1) {
    state.finished = true;
    if (remaining.length === 1) {
      remaining[0].result = '大貧民';
    }
    state.currentTurn = null;
    appendLog(state, '対局が終了しました');
  }
};

const finalizeEffectState = (state: GameState, actorId: PlayerId) => {
  checkForMatchEnd(state);
  if (state.finished) {
    state.currentTurn = null;
    return;
  }
  const stillBlocking = state.pendingEffects.some((effect) =>
    isBlockingEffectForPlayer(effect, actorId)
  );
  if (stillBlocking) {
    state.currentTurn = actorId;
    return;
  }
  state.currentTurn = calculateNextPlayer(state, actorId, false);
};

const clearStrengthReversal = (state: GameState): GameState => {
  const hadJackEffect = state.flags.jackReversalActive;
  state.flags.jackReversalActive = false;
  state.pendingEffects = state.pendingEffects.filter((effect) => effect.type !== 'jackReverse');
  syncStrengthReversalState(state);
  if (!hadJackEffect) {
    return state;
  }
  if (state.flags.revolutionActive) {
    appendLog(state, 'Jバックの効果が終了し、革命状態に戻りました');
  } else {
    appendLog(state, 'Jバックの効果が終了し、強さ順が通常に戻りました');
  }
  return state;
};

const applyRevolution = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.revolutionActive = !state.flags.revolutionActive;
  syncStrengthReversalState(state);
  const player = state.players.find((item) => item.id === playerId);
  const name = player?.name ?? '不明なプレイヤー';
  if (state.flags.revolutionActive) {
    appendLog(
      state,
      `${name} の革命！強さの順番が${state.flags.strengthReversed ? '逆転' : '通常'}になりました`
    );
  } else if (state.flags.strengthReversed) {
    appendLog(state, `${name} が革命返しを起こしましたが、J効果により強さの順番は逆転中です`);
  } else {
    appendLog(state, `${name} が革命返しを起こし、強さの順番が通常に戻りました`);
  }
  return state;
};

const registerEffects = (state: GameState, cards: Card[], playerId: PlayerId): boolean => {
  let keepTurn = false;
  const revolutionTriggered = isRevolutionPlay(cards);

  if (getEffectiveCountForRank(cards, 'J') > 0) {
    state = applyJackReverseOrder(state, playerId);
  }

  if (getEffectiveCountForRank(cards, '8') > 0) {
    state = applyEightCut(state, playerId);
    keepTurn = true;
  }

  const tenCount = getEffectiveCountForRank(cards, '10');
  if (tenCount > 0) {
    state = applyTenDiscard(state, playerId, tenCount);
  }

  const queenCount = getEffectiveCountForRank(cards, 'Q');
  if (queenCount > 0) {
    state = applyQueenPurge(state, playerId, queenCount);
  }

  const sevenCount = getEffectiveCountForRank(cards, '7');
  if (sevenCount > 0) {
    state = applySevenGive(state, playerId, sevenCount);
  }

  if (getEffectiveCountForRank(cards, '9') > 0) {
    state = applyNineReverseRotation(state, playerId);
  }

  if (revolutionTriggered) {
    state = applyRevolution(state, playerId);
  }

  return keepTurn;
};

const updateSuitLockAfterPlay = (
  state: GameState,
  cards: Card[],
  previousPlay: Play | null
): GameState => {
  if (!previousPlay) {
    return state;
  }
  if (cards.some((card) => card.rank === '8')) {
    return state;
  }
  const currentSuits = getNonJokerSuits(cards);
  const previousSuits = getNonJokerSuits(previousPlay.cards);
  if (!currentSuits.length || !previousSuits.length) {
    return state;
  }
  const sharedSuit = currentSuits.find((suit) => previousSuits.includes(suit));
  if (!sharedSuit) {
    return state;
  }
  if (state.flags.lockSuit !== sharedSuit) {
    state.flags.lockSuit = sharedSuit;
    appendLog(state, `${suitIconMap[sharedSuit]}縛りが発生しました`);
  }
  return state;
};

const updateAwaitingSpade3 = (
  state: GameState,
  cards: Card[],
  previousPlay: Play | null
): boolean => {
  if (cards.length === 1 && cards[0].rank === 'Joker') {
    state.flags.awaitingSpade3 = true;
    state.pendingEffects.push({ type: 'jokerCounter', payload: { playerId: previousPlay?.playerId } });
    appendLog(state, 'ジョーカーが場に出ました。次のプレイヤーは♠3でのみ返せます');
    return false;
  }
  state.flags.awaitingSpade3 = false;
  if (cards.length === 1 && cards[0].rank === '3' && cards[0].suit === 'spades' && previousPlay) {
    applyJokerCounterBySpade3(state, previousPlay.playerId);
    return true;
  }
  return false;
};

export const applyPlay = (
  state: GameState,
  userId: PlayerId,
  cards: Card[]
): { state: GameState; result: ValidationResult } => {
  const validation = canPlay(state, userId, cards);
  if (!validation.ok) {
    return { state, result: validation };
  }
  const previousPlay = state.table.lastPlay;
  const draft = cloneState(state);
  const playerIndex = draft.players.findIndex((item) => item.id === userId);
  if (playerIndex === -1) {
    return { state, result: { ok: false, reason: 'プレイヤーが存在しません' } };
  }
  const player = draft.players[playerIndex];
  draft.players[playerIndex] = updatePlayerHand(player, cards);
  const play: Play = {
    playerId: userId,
    cards: cards.map((card) => ({ ...card })),
    timestamp: new Date().toISOString()
  };
  draft.table.lastPlay = play;
  draft.table.requiredCount = cards.length;
  draft.table.pile = [...draft.table.pile, ...cards];
  draft.turnHistory.push(play);
  draft.passStreak = 0;
  draft.players = draft.players.map((p) => ({
    ...p,
    hasPassed: p.id === userId ? false : p.hasPassed
  }));

  appendLog(draft, `${player.name} が ${describeCards(cards)} を出しました`);

  const effectKeepTurn = registerEffects(draft, cards, userId);
  updateSuitLockAfterPlay(draft, cards, previousPlay);
  const spadeThreeKeepTurn = updateAwaitingSpade3(draft, cards, previousPlay);
  const keepTurn = effectKeepTurn || spadeThreeKeepTurn;

  if (draft.players[playerIndex].hand.length === 0) {
    draft.players[playerIndex].finished = true;
    appendLog(draft, `${player.name} があがりました！`);
    assignResultLabel(draft, userId);
  }

  checkForMatchEnd(draft);

  if (draft.finished) {
    draft.currentTurn = null;
  } else {
    const hasBlockingEffect = draft.pendingEffects.some((effect) =>
      isBlockingEffectForPlayer(effect, userId)
    );
    if (hasBlockingEffect) {
      draft.currentTurn = userId;
    } else {
      draft.currentTurn = calculateNextPlayer(draft, userId, keepTurn);
    }
  }

  return { state: draft, result: { ok: true } };
};

export const hasBlockingEffectForPlayer = (
  state: GameState,
  playerId: PlayerId
): boolean => state.pendingEffects.some((effect) => isBlockingEffectForPlayer(effect, playerId));

export const applyPass = (state: GameState, userId: PlayerId): GameState => {
  const draft = cloneState(state);
  if (draft.finished) {
    return draft;
  }
  if (hasBlockingEffectForPlayer(draft, userId)) {
    return draft;
  }
  const player = draft.players.find((item) => item.id === userId);
  if (!player) {
    return draft;
  }
  player.hasPassed = true;
  appendLog(draft, `${player.name} はパスしました`);
  draft.passStreak += 1;

  const activePlayers = draft.players.filter((item) => !item.finished);
  const everyonePassed = draft.passStreak >= Math.max(activePlayers.length - 1, 1);
  if (everyonePassed) {
    draft.table.requiredCount = null;
    draft.table.lastPlay = null;
    draft.table.pile = [];
    draft.flags.awaitingSpade3 = false;
    draft.flags.lockSuit = null;
    clearStrengthReversal(draft);
    draft.players = draft.players.map((item) => ({ ...item, hasPassed: false }));
    draft.passStreak = 0;
    const lastPlayerId = state.table.lastPlay?.playerId ?? userId;
    draft.currentTurn = lastPlayerId;
    appendLog(draft, '全員がパスしたため場が流れました');
    return draft;
  }

  const nextPlayer = calculateNextPlayer(draft, userId, false);
  draft.currentTurn = nextPlayer;
  return draft;
};

const findEffectIndexForAction = (state: GameState, action: EffectAction): number =>
  state.pendingEffects.findIndex(
    (effect) => effect.type === action.type && effect.payload?.playerId === action.playerId
  );

const extractCardsFromHand = (player: GamePlayer, cardIds: string[]): Card[] => {
  const map = new Map(player.hand.map((card) => [card.id, card]));
  const cards: Card[] = [];
  for (const id of cardIds) {
    const card = map.get(id);
    if (!card) {
      return [];
    }
    cards.push(card);
  }
  return cards;
};

const removeCardsById = (hand: Card[], cardIds: string[]): Card[] => {
  const idSet = new Set(cardIds);
  if (!idSet.size) {
    return [...hand];
  }
  return hand.filter((card) => !idSet.has(card.id));
};

const isPlayableRank = (rank: Rank): boolean => rank !== 'Joker';

export const applyEffectAction = (
  state: GameState,
  action: EffectAction
): { state: GameState; result: ValidationResult } => {
  const draft = cloneState(state);
  if (draft.finished) {
    return { state: draft, result: { ok: false, reason: '対局は終了しています' } };
  }
  if (draft.currentTurn !== action.playerId) {
    return { state: draft, result: { ok: false, reason: '現在はあなたの処理順ではありません' } };
  }

  const playerIndex = draft.players.findIndex((item) => item.id === action.playerId);
  if (playerIndex === -1) {
    return { state: draft, result: { ok: false, reason: 'プレイヤーが見つかりません' } };
  }
  const player = draft.players[playerIndex];

  const effectIndex = findEffectIndexForAction(draft, action);
  if (effectIndex === -1) {
    return { state: draft, result: { ok: false, reason: '処理すべき効果がありません' } };
  }

  const effect = draft.pendingEffects[effectIndex];

  if (!isBlockingEffectForPlayer(effect, action.playerId) && effect.type !== 'queenPurge') {
    return {
      state: draft,
      result: { ok: false, reason: 'この効果は処理済みです' }
    };
  }

  if (effect.type !== action.type) {
    return { state: draft, result: { ok: false, reason: '効果情報が一致しません' } };
  }

  switch (action.type) {
    case 'sevenGive':
    case 'tenDiscard': {
      const limit = typeof effect.payload?.count === 'number' ? effect.payload.count : 0;
      const uniqueIds = [...new Set(action.cards)];
      if (uniqueIds.length !== action.cards.length) {
        return {
          state: draft,
          result: { ok: false, reason: '同じカードを複数回選択することはできません' }
        };
      }
      if (uniqueIds.length > limit) {
        return {
          state: draft,
          result: { ok: false, reason: `最大${limit}枚まで選択できます` }
        };
      }
      const cards = extractCardsFromHand(player, uniqueIds);
      if (cards.length !== uniqueIds.length) {
        return { state: draft, result: { ok: false, reason: '無効なカードが含まれています' } };
      }
      let targetIndex = -1;
      if (action.type === 'sevenGive' && cards.length > 0) {
        const targetId = calculateNextPlayer(draft, action.playerId, false);
        if (!targetId) {
          return {
            state: draft,
            result: { ok: false, reason: '渡せる相手がいません' }
          };
        }
        targetIndex = draft.players.findIndex((item) => item.id === targetId);
        if (targetIndex === -1) {
          return {
            state: draft,
            result: { ok: false, reason: '渡せる相手がいません' }
          };
        }
      }
      draft.players[playerIndex] = {
        ...player,
        hand: removeCardsById(player.hand, uniqueIds),
        hasPassed: false
      };

      if (action.type === 'sevenGive' && cards.length > 0) {
        const receiver = draft.players[targetIndex];
        draft.players[targetIndex] = {
          ...receiver,
          hand: [...receiver.hand, ...cards]
        };
        appendLog(draft, `${player.name} が7渡しで ${cards.length}枚を ${receiver.name} に渡しました`);
      } else if (action.type === 'sevenGive') {
        appendLog(draft, `${player.name} は7渡しでカードを渡しませんでした`);
      }

      if (action.type === 'tenDiscard') {
        if (cards.length > 0) {
          appendLog(draft, `${player.name} が10捨てで ${cards.length}枚捨てました`);
        } else {
          appendLog(draft, `${player.name} は10捨てでカードを捨てませんでした`);
        }
      }

      const updatedPlayer = draft.players[playerIndex];
      completePlayerIfOutOfCards(draft, updatedPlayer);

      draft.pendingEffects.splice(effectIndex, 1);
      finalizeEffectState(draft, action.playerId);
      return { state: draft, result: { ok: true } };
    }

    case 'queenPurge': {
      if (!isPlayableRank(action.rank)) {
        return { state: draft, result: { ok: false, reason: '選択できないランクです' } };
      }
      const remaining = getEffectRemaining(effect);
      if (remaining <= 0) {
      return { state: draft, result: { ok: false, reason: 'この効果は処理済みです' } };
    }

    let removedTotal = 0;
    draft.players = draft.players.map((p) => {
      if (p.hand.length === 0) {
        return p;
      }
      const removed = p.hand.filter((card) => card.rank === action.rank);
      if (!removed.length) {
        return p;
      }
      removedTotal += removed.length;
      const nextPlayer = {
        ...p,
        hand: p.hand.filter((card) => card.rank !== action.rank)
      };
      completePlayerIfOutOfCards(draft, nextPlayer);
      return nextPlayer;
    });

    const payload = effect.payload ?? {};
    const nextRemaining = Math.max(0, remaining - 1);
    payload.remaining = nextRemaining;
    payload.declaredRanks = [...(payload.declaredRanks ?? []), action.rank];
    effect.payload = payload;

    appendLog(
      draft,
      `${player.name} がQボンバーで ${action.rank} を宣言し、${removedTotal}枚が捨てられました`
    );

    if (nextRemaining === 0) {
      draft.pendingEffects.splice(effectIndex, 1);
    } else {
      draft.pendingEffects[effectIndex] = effect;
    }

    finalizeEffectState(draft, action.playerId);
    return { state: draft, result: { ok: true } };
    }

    default:
      return { state: draft, result: { ok: false, reason: '未対応の効果です' } };
  }
};

export const applyEightCut = (state: GameState, playerId: PlayerId): GameState => {
  appendLog(state, '8切り！場が流れます');
  state.table.requiredCount = null;
  state.table.lastPlay = null;
  state.table.pile = [];
  state.passStreak = 0;
  state.players = state.players.map((player) => ({ ...player, hasPassed: false }));
  state.flags.awaitingSpade3 = false;
  state.flags.lockSuit = null;
  clearStrengthReversal(state);
  return state;
};

export const applyTenDiscard = (
  state: GameState,
  playerId: PlayerId,
  count: number
): GameState => {
  state.pendingEffects.push({
    type: 'tenDiscard',
    payload: { playerId, count, optional: true, remaining: count }
  });
  appendLog(state, `10捨て：最大${count}枚まで任意のカードを捨てられます`);
  return state;
};

export const applyQueenPurge = (
  state: GameState,
  playerId: PlayerId,
  count: number
): GameState => {
  state.pendingEffects.push({
    type: 'queenPurge',
    payload: { playerId, count, remaining: count, declaredRanks: [] }
  });
  appendLog(state, `Qボンバー：宣言を${count}回行ってください`);
  return state;
};

export const applySevenGive = (
  state: GameState,
  playerId: PlayerId,
  count: number
): GameState => {
  state.pendingEffects.push({
    type: 'sevenGive',
    payload: { playerId, count, optional: true, remaining: count }
  });
  appendLog(state, `7渡し：最大${count}枚まで任意のカードを渡せます`);
  return state;
};

export const applyJackReverseOrder = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.jackReversalActive = !state.flags.jackReversalActive;
  syncStrengthReversalState(state);
  appendLog(state, `J効果：強さの順番が${state.flags.strengthReversed ? '逆転' : '通常'}になりました`);
  state.pendingEffects = state.pendingEffects.filter((effect) => effect.type !== 'jackReverse');
  if (state.flags.jackReversalActive) {
    state.pendingEffects.push({ type: 'jackReverse', payload: { playerId } });
  }
  return state;
};

export const applyJokerCounterBySpade3 = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.awaitingSpade3 = false;
  state.flags.lockSuit = null;
  state.table.requiredCount = null;
  state.table.lastPlay = null;
  state.table.pile = [];
  state.passStreak = 0;
  state.players = state.players.map((player) => ({ ...player, hasPassed: false }));
  clearStrengthReversal(state);
  appendLog(state, '♠3がジョーカーを打ち消しました');
  state.pendingEffects.push({ type: 'jokerCounter', payload: { playerId } });
  return state;
};

export const applyNineReverseRotation = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.rotationReversed = !state.flags.rotationReversed;
  appendLog(state, `9の効果：順番が${state.flags.rotationReversed ? '逆回り' : '通常回り'}になりました`);
  state.pendingEffects.push({ type: 'nineReverse', payload: { playerId } });
  return state;
};

export const syncForClient = (state: GameState, viewerId: PlayerId): PublicState => ({
  roomCode: state.roomCode,
  players: state.players.map((player) => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    handCount: player.hand.length,
    connected: player.connected,
    finished: player.finished,
    result: player.result,
    isSelf: player.id === viewerId,
    hand: player.id === viewerId ? player.hand : undefined,
    ready: player.ready
  })),
  currentTurn: state.currentTurn,
  flags: { ...state.flags },
  table: {
    lastPlay: state.table.lastPlay,
    requiredCount: state.table.requiredCount,
    pile: state.table.pile,
    logs: state.table.logs
  },
  pendingEffects: state.pendingEffects,
  finished: state.finished
});

export const startGameIfReady = (state: GameState): GameState => {
  if (state.players.length < MIN_PLAYERS) {
    return state;
  }
  const alreadyDealt = state.players.some((player) => player.hand.length > 0);
  if (alreadyDealt) {
    return state;
  }
  const everyoneReady = state.players.every((player) => player.ready);
  if (!everyoneReady) {
    return state;
  }
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  const playerIds = ordered.map((player) => player.id);
  const { hands, starter } = dealCards(playerIds);
  state.flags = {
    strengthReversed: false,
    revolutionActive: false,
    jackReversalActive: false,
    rotationReversed: false,
    lockSuit: null,
    awaitingSpade3: false
  };
  state.table = {
    lastPlay: null,
    requiredCount: null,
    pile: [],
    logs: []
  };
  state.pendingEffects = [];
  state.turnHistory = [];
  state.passStreak = 0;
  state.finished = false;
  state.players = state.players.map((player) => ({
    ...player,
    hand: hands[player.id] ?? [],
    finished: false,
    hasPassed: false,
    result: null,
    ready: false
  }));
  state.currentTurn = starter ?? playerIds[0] ?? null;
  state.startingPlayer = state.currentTurn;
  appendLog(state, 'カードが配られました。ダイヤの3を持つプレイヤーから開始します');
  return state;
};

export const removePlayer = (
  state: GameState,
  playerId: PlayerId,
  options?: { resultLabel?: string }
): GameState => {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index === -1) {
    return state;
  }

  const leavingPlayer = state.players[index];
  const hasDealt = state.players.some((player) => player.hand.length > 0);

  appendLog(state, `${leavingPlayer.name} さんが退室しました`);

  if (!hasDealt) {
    state.players.splice(index, 1);
    if (state.currentTurn === playerId) {
      const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
      state.currentTurn = ordered[0]?.id ?? null;
      state.startingPlayer = state.currentTurn;
    }
    return state;
  }

  state.players[index] = {
    ...leavingPlayer,
    connected: false,
    finished: true,
    result: options?.resultLabel ?? leavingPlayer.result ?? '退室',
    hand: [],
    hasPassed: true,
    ready: false
  };

  if (state.currentTurn === playerId) {
    state.currentTurn = calculateNextPlayer(state, playerId, false);
  }

  checkForMatchEnd(state);

  return state;
};
