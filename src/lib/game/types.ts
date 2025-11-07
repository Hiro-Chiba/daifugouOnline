export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank =
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | '2'
  | 'Joker';

export interface Card {
  id: string;
  suit: Suit | 'joker';
  rank: Rank;
}

export type PlayerId = string;

export interface GamePlayer {
  id: PlayerId;
  name: string;
  seat: number;
  hand: Card[];
  connected: boolean;
  finished: boolean;
  result?: string | null;
  hasPassed: boolean;
}

export interface Play {
  playerId: PlayerId;
  cards: Card[];
  timestamp: string;
}

export interface TableState {
  lastPlay: Play | null;
  requiredCount: number | null;
  pile: Card[];
  logs: string[];
}

export interface Flags {
  strengthReversed: boolean;
  rotationReversed: boolean;
  lockSuit: Suit | null;
  awaitingSpade3: boolean;
}

export type EffectType =
  | 'eightCut'
  | 'tenDiscard'
  | 'queenPurge'
  | 'sevenGive'
  | 'jackReverse'
  | 'jokerCounter'
  | 'nineReverse';

export interface EffectPayload {
  playerId?: PlayerId;
  count?: number;
  optional?: boolean;
  remaining?: number;
  declaredRanks?: Rank[];
}

export interface Effect {
  type: EffectType;
  payload?: EffectPayload;
}

export interface GameState {
  roomCode: string;
  players: GamePlayer[];
  currentTurn: PlayerId | null;
  startingPlayer: PlayerId | null;
  flags: Flags;
  table: TableState;
  pendingEffects: Effect[];
  turnHistory: Play[];
  finished: boolean;
  passStreak: number;
  matchId: string | null;
}

export interface PublicPlayerState {
  id: PlayerId;
  name: string;
  seat: number;
  handCount: number;
  connected: boolean;
  finished: boolean;
  result?: string | null;
  isSelf: boolean;
  hand?: Card[];
}

export interface PublicState {
  roomCode: string;
  players: PublicPlayerState[];
  currentTurn: PlayerId | null;
  flags: Flags;
  table: TableState;
  pendingEffects: Effect[];
  finished: boolean;
}

export type EffectAction =
  | { type: 'sevenGive'; playerId: PlayerId; cards: string[] }
  | { type: 'tenDiscard'; playerId: PlayerId; cards: string[] }
  | { type: 'queenPurge'; playerId: PlayerId; rank: Rank };

export interface ValidationSuccess {
  ok: true;
}

export interface ValidationFailure {
  ok: false;
  reason: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;
