
export type CardPreference = 'lowest' | 'highest' | 'balanced';
export type QueenPreference = 'rarest' | 'common' | 'highest';

export interface NpcStrategyWeights {
  base: number;
  aggression: number;
  conserveHigh: number;
  lowCardBias: number;
  combo: number;
  keepTurn: number;
  revolution: number;
  finish: number;
  respondPressure: number;
  openingInitiative: number;
  counterBonus: number;
  holdJoker: number;
  randomness: number;
}

export interface NpcEffectWeights {
  eightCut: number;
  tenDiscard: number;
  sevenGive: number;
  queenPurge: number;
  jackReverse: number;
  nineReverse: number;
  joker: number;
}

export interface NpcOptionalEffectUsage {
  sevenGive: number;
  tenDiscard: number;
}

export interface NpcStrategyProfile {
  weights: NpcStrategyWeights;
  effectWeights: NpcEffectWeights;
  thresholds: {
    pass: number;
  };
  effectPreferences: {
    sevenGive: CardPreference;
    tenDiscard: CardPreference;
    queenPurge: QueenPreference;
  };
  optionalEffectUsage: NpcOptionalEffectUsage;
}

export interface NpcDefinition {
  id: string;
  name: string;
  mbtiType: string;
  roleDescription: string;
  strategy: NpcStrategyProfile;
}

export interface ActiveNpc {
  playerId: string;
  definition: NpcDefinition;
}
