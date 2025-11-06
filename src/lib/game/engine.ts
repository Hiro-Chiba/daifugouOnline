import { format } from 'date-fns';
import { dealCards } from './deal';
import { MIN_PLAYERS } from './constants';
import { canPlay } from './validators';
import type { Card, GamePlayer, GameState, PlayerId, Play, PublicState, ValidationResult } from './types';

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

const registerEffects = (state: GameState, cards: Card[], playerId: PlayerId): boolean => {
  let keepTurn = false;
  if (cards.some((card) => card.rank === 'J')) {
    state = applyJackReverseOrder(state, playerId);
  }
  if (cards.some((card) => card.rank === '8')) {
    state = applyEightCut(state, playerId);
    keepTurn = true;
  }
  if (cards.some((card) => card.rank === '10')) {
    state = applyTenDiscard(state, playerId);
  }
  if (cards.some((card) => card.rank === 'Q')) {
    state = applyQueenPurge(state, playerId);
  }
  if (cards.some((card) => card.rank === '7')) {
    state = applySevenGive(state, playerId);
  }
  if (cards.length === 3 && cards.every((card) => card.rank === '9')) {
    state = applyNineReverseRotation(state, playerId);
  }
  return keepTurn;
};

const updateAwaitingSpade3 = (
  state: GameState,
  cards: Card[],
  previousPlay: Play | null
): GameState => {
  if (cards.length === 1 && cards[0].rank === 'Joker') {
    state.flags.awaitingSpade3 = true;
    state.pendingEffects.push({ type: 'jokerCounter', payload: { playerId: previousPlay?.playerId } });
    appendLog(state, 'ジョーカーが場に出ました。次のプレイヤーは♠3でのみ返せます');
    return state;
  }
  state.flags.awaitingSpade3 = false;
  if (cards.length === 1 && cards[0].rank === '3' && cards[0].suit === 'spades' && previousPlay) {
    return applyJokerCounterBySpade3(state, previousPlay.playerId);
  }
  return state;
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

  const keepTurn = registerEffects(draft, cards, userId);
  updateAwaitingSpade3(draft, cards, state.table.lastPlay);

  if (draft.players[playerIndex].hand.length === 0) {
    draft.players[playerIndex].finished = true;
    appendLog(draft, `${player.name} があがりました！`);
    assignResultLabel(draft, userId);
  }

  checkForMatchEnd(draft);

  if (!draft.finished) {
    draft.currentTurn = calculateNextPlayer(draft, userId, keepTurn);
  } else {
    draft.currentTurn = null;
  }

  return { state: draft, result: { ok: true } };
};

export const applyPass = (state: GameState, userId: PlayerId): GameState => {
  const draft = cloneState(state);
  if (draft.finished) {
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

export const applyEightCut = (state: GameState, playerId: PlayerId): GameState => {
  appendLog(state, '8切り！場が流れます');
  state.table.requiredCount = null;
  state.table.lastPlay = null;
  state.table.pile = [];
  state.passStreak = 0;
  state.players = state.players.map((player) => ({ ...player, hasPassed: false }));
  state.flags.awaitingSpade3 = false;
  return state;
};

export const applyTenDiscard = (state: GameState, playerId: PlayerId): GameState => {
  state.pendingEffects.push({ type: 'tenDiscard', payload: { playerId } });
  appendLog(state, '10捨て：任意のカードを1枚捨ててください');
  return state;
};

export const applyQueenPurge = (state: GameState, playerId: PlayerId): GameState => {
  state.pendingEffects.push({ type: 'queenPurge', payload: { playerId } });
  appendLog(state, 'Q全消し：指定ランクのカードを全員が捨てます');
  return state;
};

export const applySevenGive = (state: GameState, playerId: PlayerId): GameState => {
  state.pendingEffects.push({ type: 'sevenGive', payload: { playerId } });
  appendLog(state, '7渡し：相手にカードを1枚渡してください');
  return state;
};

export const applyJackReverseOrder = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.strengthReversed = !state.flags.strengthReversed;
  appendLog(state, `J効果：強さの順番が${state.flags.strengthReversed ? '逆転' : '通常'}になりました`);
  state.pendingEffects.push({ type: 'jackReverse', payload: { playerId } });
  return state;
};

export const applyJokerCounterBySpade3 = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.awaitingSpade3 = false;
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
    hand: player.id === viewerId ? player.hand : undefined
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
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  const playerIds = ordered.map((player) => player.id);
  const { hands, starter } = dealCards(playerIds);
  state.flags = {
    strengthReversed: false,
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
    result: null
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
    hasPassed: true
  };

  if (state.currentTurn === playerId) {
    state.currentTurn = calculateNextPlayer(state, playerId, false);
  }

  checkForMatchEnd(state);

  return state;
};
