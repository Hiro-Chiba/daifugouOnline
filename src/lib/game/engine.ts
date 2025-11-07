import { format } from 'date-fns';
import { dealCards } from './deal';
import { MIN_PLAYERS } from './constants';
import { canPlay } from './validators';
import type {
  Card,
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

const rankLabelMap: Record<Rank, string> = {
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
  '2': '2',
  Joker: 'ジョーカー'
};

const describeRank = (rank: Rank): string => rankLabelMap[rank] ?? rank;

const countByRank = (cards: Card[], rank: Rank): number =>
  cards.filter((card) => card.rank === rank).length;

const countJokers = (cards: Card[]): number => countByRank(cards, 'Joker');

const jokerComboRanks: Rank[] = ['7', '8', '9', '10', 'J', 'Q'];
const queenBomberRanks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const getEffectiveCountForRank = (cards: Card[], rank: Rank): number => {
  if (rank === 'Joker') {
    return countJokers(cards);
  }
  const rankCount = countByRank(cards, rank);
  if (rankCount === 0) {
    return 0;
  }
  const jokers = countJokers(cards);
  const total = rankCount + jokers;
  if (jokers > 0 && jokerComboRanks.includes(rank)) {
    return Math.max(total, 3);
  }
  return total;
};

const getNonJokerCards = (cards: Card[]): Card[] =>
  cards.filter((card) => card.rank !== 'Joker');

const getUniformRankOrNull = (cards: Card[]): Rank | null => {
  const nonJokers = getNonJokerCards(cards);
  if (!nonJokers.length) {
    return null;
  }
  const firstRank = nonJokers[0].rank;
  if (nonJokers.every((card) => card.rank === firstRank)) {
    return firstRank;
  }
  return null;
};

const getNonJokerSuits = (cards: Card[]): Suit[] =>
  cards.filter((card) => card.suit !== 'joker').map((card) => card.suit as Suit);

const getPlayerName = (state: GameState, playerId: PlayerId): string => {
  const player = state.players.find((item) => item.id === playerId);
  return player?.name ?? 'プレイヤー';
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
  activeEffect: state.activeEffect ? { ...state.activeEffect } : null,
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
  activeEffect: null,
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

  const uniformRank = getUniformRankOrNull(cards);
  const revolutionCount = uniformRank ? getEffectiveCountForRank(cards, uniformRank) : 0;
  const revolutionTriggered = revolutionCount >= 4 && cards.length >= 4 && !!uniformRank;

  if (revolutionTriggered && uniformRank) {
    state = applyRevolution(state, playerId, revolutionCount, uniformRank);
  }

  if (!revolutionTriggered && getEffectiveCountForRank(cards, 'J') > 0) {
    state = applyJackBack(state, playerId);
  }

  if (getEffectiveCountForRank(cards, '8') > 0) {
    state = applyEightCut(state, playerId);
    keepTurn = true;
  }

  const tenCount = getEffectiveCountForRank(cards, '10');
  if (tenCount > 0) {
    state = applyTenDiscard(state, playerId, tenCount);
    keepTurn = true;
  }

  const queenCount = getEffectiveCountForRank(cards, 'Q');
  if (queenCount > 0) {
    state = applyQueenPurge(state, playerId, queenCount);
  }

  const sevenCount = getEffectiveCountForRank(cards, '7');
  if (sevenCount > 0) {
    state = applySevenGive(state, playerId, sevenCount);
    keepTurn = true;
  }

  if (getEffectiveCountForRank(cards, '9') > 0) {
    state = applyNineReverseRotation(state, playerId);
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
  const keepTurn = effectKeepTurn || spadeThreeKeepTurn || draft.activeEffect?.playerId === userId;

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
    draft.flags.lockSuit = null;
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
  const playerName = getPlayerName(state, playerId);
  appendLog(state, `8切り！${playerName} が場を流しました（同じプレイヤーの手番です）`);
  state.table.requiredCount = null;
  state.table.lastPlay = null;
  state.table.pile = [];
  state.passStreak = 0;
  state.players = state.players.map((player) => ({ ...player, hasPassed: false }));
  state.flags.awaitingSpade3 = false;
  state.flags.lockSuit = null;
  return state;
};

export const applyTenDiscard = (
  state: GameState,
  playerId: PlayerId,
  count: number
): GameState => {
  state.activeEffect = { type: 'tenDiscard', playerId, maxCount: count };
  appendLog(state, `10捨て：最大${count}枚まで任意のカードを捨てられます`);
  return state;
};

export const applyQueenPurge = (
  state: GameState,
  playerId: PlayerId,
  count: number
): GameState => {
  state.activeEffect = {
    type: 'queenBomber',
    playerId,
    remaining: count,
    totalCount: count
  };
  appendLog(state, `Qボンバー：宣言を${count}回行ってください`);
  return state;
};

export const applySevenGive = (
  state: GameState,
  playerId: PlayerId,
  count: number
): GameState => {
  state.activeEffect = { type: 'sevenGive', playerId, maxCount: count };
  appendLog(state, `7渡し：最大${count}枚まで任意のカードを渡せます`);
  return state;
};

export const applyJackBack = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.strengthReversed = !state.flags.strengthReversed;
  const playerName = getPlayerName(state, playerId);
  appendLog(
    state,
    `Jバック：${playerName} が強さの順番を${state.flags.strengthReversed ? '逆転させました' : '通常に戻しました'}`
  );
  return state;
};

export const applyRevolution = (
  state: GameState,
  playerId: PlayerId,
  count: number,
  rank: Rank
): GameState => {
  state.flags.strengthReversed = !state.flags.strengthReversed;
  appendLog(
    state,
    `革命！${rank}の${count}枚出しで強さの順番が${state.flags.strengthReversed ? '逆転しました' : '通常に戻りました'}`
  );
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
  appendLog(state, '♠3がジョーカーを打ち消しました');
  return state;
};

export const applyNineReverseRotation = (state: GameState, playerId: PlayerId): GameState => {
  state.flags.rotationReversed = !state.flags.rotationReversed;
  appendLog(state, `9の効果：順番が${state.flags.rotationReversed ? '逆回り' : '通常回り'}になりました`);
  return state;
};

interface EffectActionOptions {
  action: 'execute' | 'skip';
  cards: Card[];
  targetPlayerId?: PlayerId | null;
  declaredRank?: Rank | null;
}

const findPlayerIndex = (state: GameState, playerId: PlayerId): number =>
  state.players.findIndex((player) => player.id === playerId);

const cloneCards = (cards: Card[]): Card[] => cards.map((card) => ({ ...card }));

const ensureCardsBelongToPlayer = (player: GamePlayer, cards: Card[]): ValidationResult => {
  const handIds = new Set(player.hand.map((card) => card.id));
  for (const card of cards) {
    if (!handIds.has(card.id)) {
      return { ok: false, reason: '手札に存在しないカードが含まれています' };
    }
  }
  return { ok: true };
};

const assignFinishIfNeeded = (state: GameState, playerId: PlayerId) => {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || player.finished) {
    return;
  }
  if (player.hand.length === 0) {
    player.finished = true;
    appendLog(state, `${player.name} があがりました！`);
    assignResultLabel(state, playerId);
  }
};

const finalizeEffectResolution = (
  state: GameState,
  actorId: PlayerId,
  extraPlayerIds: PlayerId[] = []
) => {
  const toCheck = new Set<PlayerId>([actorId, ...extraPlayerIds]);
  toCheck.forEach((id) => assignFinishIfNeeded(state, id));
  checkForMatchEnd(state);
  if (!state.finished) {
    advanceTurnAfterEffect(state, actorId);
  } else {
    state.currentTurn = null;
  }
};

const updateFinishes = (state: GameState, playerIds: PlayerId[]) => {
  const unique = new Set<PlayerId>(playerIds);
  unique.forEach((id) => assignFinishIfNeeded(state, id));
  checkForMatchEnd(state);
};

const advanceTurnAfterEffect = (state: GameState, playerId: PlayerId) => {
  if (state.finished) {
    state.currentTurn = null;
    return;
  }
  const nextPlayer = calculateNextPlayer(state, playerId, false);
  state.currentTurn = nextPlayer;
};

export const resolveActiveEffect = (
  state: GameState,
  userId: PlayerId,
  options: EffectActionOptions
): { state: GameState; result: ValidationResult } => {
  if (!state.activeEffect) {
    return { state, result: { ok: false, reason: '処理すべき効果はありません' } };
  }
  if (state.activeEffect.playerId !== userId) {
    return { state, result: { ok: false, reason: '効果を実行できるのは発動したプレイヤーのみです' } };
  }

  const draft = cloneState(state);
  const effect = draft.activeEffect;
  if (!effect) {
    return { state, result: { ok: false, reason: '処理すべき効果はありません' } };
  }

  const playerIndex = findPlayerIndex(draft, userId);
  if (playerIndex === -1) {
    return { state, result: { ok: false, reason: 'プレイヤーが見つかりません' } };
  }

  const actingPlayer = draft.players[playerIndex];
  const playerName = actingPlayer.name;

  if (effect.type === 'queenBomber') {
    if (options.action !== 'execute') {
      return { state, result: { ok: false, reason: '宣言をスキップすることはできません' } };
    }
    const declaredRank = options.declaredRank ?? null;
    if (!declaredRank) {
      return { state, result: { ok: false, reason: '宣言する数字を選択してください' } };
    }
    if (!queenBomberRanks.includes(declaredRank)) {
      return { state, result: { ok: false, reason: '宣言できない数字です' } };
    }
    if (declaredRank === 'Joker') {
      return { state, result: { ok: false, reason: 'ジョーカーは宣言できません' } };
    }

    const removedByPlayer = draft.players.map((player) => {
      const matches = player.hand.filter((card) => card.rank === declaredRank);
      return { player, matches };
    });

    const totalRemoved = removedByPlayer.reduce((sum, item) => sum + item.matches.length, 0);
    if (totalRemoved > 0) {
      const removedCards = removedByPlayer.flatMap((item) =>
        item.matches.map((card) => ({ ...card }))
      );
      draft.table.pile = [...draft.table.pile, ...removedCards];
    }

    draft.players = removedByPlayer.map(({ player, matches }) => ({
      ...player,
      hand: matches.length > 0 ? player.hand.filter((card) => card.rank !== declaredRank) : player.hand
    }));

    if (totalRemoved > 0) {
      appendLog(
        draft,
        `Qボンバー：${playerName} が${describeRank(declaredRank)}を宣言し、合計${totalRemoved}枚捨てられました`
      );
    } else {
      appendLog(
        draft,
        `Qボンバー：${playerName} が${describeRank(declaredRank)}を宣言しましたが、捨てるカードはありませんでした`
      );
    }

    const affectedIds = removedByPlayer
      .filter((item) => item.matches.length > 0)
      .map((item) => item.player.id);
    updateFinishes(draft, [userId, ...affectedIds]);

    if (draft.finished) {
      draft.activeEffect = null;
      draft.currentTurn = null;
      return { state: draft, result: { ok: true } };
    }

    const remaining = Math.max(effect.remaining - 1, 0);
    if (remaining > 0) {
      draft.activeEffect = {
        type: 'queenBomber',
        playerId: effect.playerId,
        remaining,
        totalCount: effect.totalCount
      };
      draft.currentTurn = userId;
      return { state: draft, result: { ok: true } };
    }

    draft.activeEffect = null;
    finalizeEffectResolution(draft, userId, affectedIds);
    return { state: draft, result: { ok: true } };
  }

  if (effect.type !== 'tenDiscard' && effect.type !== 'sevenGive') {
    return { state, result: { ok: false, reason: '未対応の効果です' } };
  }

  const uniqueIds = new Set(options.cards.map((card) => card.id));
  if (uniqueIds.size !== options.cards.length) {
    return { state, result: { ok: false, reason: '同じカードを複数選択しています' } };
  }

  if (options.cards.length > effect.maxCount) {
    return { state, result: { ok: false, reason: '選択可能な枚数を超えています' } };
  }

  if (options.action === 'skip' && options.cards.length > 0) {
    return { state, result: { ok: false, reason: '何もしない場合はカードを選択しないでください' } };
  }

  if (options.action === 'execute' && options.cards.length === 0) {
    return { state, result: { ok: false, reason: 'カードを選択してください' } };
  }

  const ownershipCheck = ensureCardsBelongToPlayer(actingPlayer, options.cards);
  if (!ownershipCheck.ok) {
    return { state, result: ownershipCheck };
  }

  const selectedCards = actingPlayer.hand
    .filter((card) => uniqueIds.has(card.id))
    .map((card) => ({ ...card }));

  if (effect.type === 'tenDiscard') {
    if (options.action === 'execute') {
      draft.players[playerIndex] = updatePlayerHand(actingPlayer, selectedCards);
      draft.table.pile = [...draft.table.pile, ...cloneCards(selectedCards)];
      appendLog(
        draft,
        `10捨て：${playerName} が${selectedCards.length}枚捨てました（${describeCards(selectedCards)}）`
      );
    } else {
      appendLog(draft, `10捨て：${playerName} は何もしませんでした`);
    }
  } else if (effect.type === 'sevenGive') {
    if (options.action === 'execute') {
      const targetId = options.targetPlayerId ?? null;
      if (!targetId || targetId === userId) {
        return { state, result: { ok: false, reason: '渡す相手を選択してください' } };
      }
      const targetIndex = findPlayerIndex(draft, targetId);
      if (targetIndex === -1) {
        return { state, result: { ok: false, reason: '渡す相手が見つかりません' } };
      }
      const targetPlayer = draft.players[targetIndex];
      if (targetPlayer.finished) {
        return { state, result: { ok: false, reason: '既に上がった相手には渡せません' } };
      }
      draft.players[playerIndex] = updatePlayerHand(actingPlayer, selectedCards);
      draft.players[targetIndex] = {
        ...targetPlayer,
        hand: [...targetPlayer.hand, ...cloneCards(selectedCards)]
      };
      appendLog(
        draft,
        `7渡し：${playerName} が${targetPlayer.name}に${selectedCards.length}枚渡しました（${describeCards(
          selectedCards
        )}）`
      );
    } else {
      appendLog(draft, `7渡し：${playerName} は何もしませんでした`);
    }
  } else {
    return { state, result: { ok: false, reason: '未対応の効果です' } };
  }

  draft.activeEffect = null;
  finalizeEffectResolution(draft, userId);

  return { state: draft, result: { ok: true } };
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
  activeEffect: state.activeEffect,
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
  state.activeEffect = null;
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
