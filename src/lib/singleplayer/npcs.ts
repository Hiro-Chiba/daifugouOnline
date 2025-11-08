import type { NpcDefinition } from './types';

export const NPC_DEFINITIONS: NpcDefinition[] = [
  {
    id: 'intj',
    name: 'INTJ',
    mbtiType: 'INTJ',
    roleDescription: '長期的な勝利を設計する支配者的プレイヤー',
    strategy: {
      weights: {
        base: -0.1,
        aggression: 0.6,
        conserveHigh: 0.8,
        lowCardBias: 0.4,
        combo: 0.7,
        keepTurn: 0.5,
        revolution: 0.7,
        finish: 1.0,
        respondPressure: 0.6,
        openingInitiative: 0.3,
        counterBonus: 0.5,
        holdJoker: 0.9,
        randomness: 0.05
      },
      effectWeights: {
        eightCut: 0.4,
        tenDiscard: 0.6,
        sevenGive: -0.2,
        queenPurge: 0.5,
        jackReverse: 0.4,
        nineReverse: 0.1,
        joker: 0.2
      },
      thresholds: {
        pass: 0.25
      },
      effectPreferences: {
        sevenGive: 'highest',
        tenDiscard: 'highest',
        queenPurge: 'rarest'
      },
      optionalEffectUsage: {
        sevenGive: 0.5,
        tenDiscard: 0.8
      }
    }
  },
  {
    id: 'entj',
    name: 'ENTJ',
    mbtiType: 'ENTJ',
    roleDescription: '場を掌握しリードする圧倒的プレイヤー',
    strategy: {
      weights: {
        base: 0.1,
        aggression: 0.95,
        conserveHigh: 0.2,
        lowCardBias: 0.2,
        combo: 0.8,
        keepTurn: 0.8,
        revolution: 0.6,
        finish: 1.2,
        respondPressure: 0.9,
        openingInitiative: 0.6,
        counterBonus: 0.4,
        holdJoker: 0.4,
        randomness: 0.15
      },
      effectWeights: {
        eightCut: 0.8,
        tenDiscard: 0.7,
        sevenGive: 0.3,
        queenPurge: 0.6,
        jackReverse: 0.5,
        nineReverse: 0.3,
        joker: 0.6
      },
      thresholds: {
        pass: -0.05
      },
      effectPreferences: {
        sevenGive: 'highest',
        tenDiscard: 'highest',
        queenPurge: 'highest'
      },
      optionalEffectUsage: {
        sevenGive: 0.85,
        tenDiscard: 0.9
      }
    }
  },
  {
    id: 'intp',
    name: 'INTP',
    mbtiType: 'INTP',
    roleDescription: '革新的な戦略を試す分析プレイヤー',
    strategy: {
      weights: {
        base: -0.05,
        aggression: 0.5,
        conserveHigh: 0.3,
        lowCardBias: 0.35,
        combo: 0.5,
        keepTurn: 0.6,
        revolution: 0.5,
        finish: 0.9,
        respondPressure: 0.55,
        openingInitiative: 0.35,
        counterBonus: 0.5,
        holdJoker: 0.6,
        randomness: 0.4
      },
      effectWeights: {
        eightCut: 0.5,
        tenDiscard: 0.5,
        sevenGive: 0.1,
        queenPurge: 0.8,
        jackReverse: 0.7,
        nineReverse: 0.4,
        joker: 0.5
      },
      thresholds: {
        pass: 0.1
      },
      effectPreferences: {
        sevenGive: 'balanced',
        tenDiscard: 'highest',
        queenPurge: 'rarest'
      },
      optionalEffectUsage: {
        sevenGive: 0.6,
        tenDiscard: 0.7
      }
    }
  },
  {
    id: 'entp',
    name: 'ENTP',
    mbtiType: 'ENTP',
    roleDescription: '駆け引き好きで逆転劇を演出するエンターテイナー型',
    strategy: {
      weights: {
        base: 0.05,
        aggression: 0.8,
        conserveHigh: 0.2,
        lowCardBias: 0.1,
        combo: 0.7,
        keepTurn: 0.9,
        revolution: 0.5,
        finish: 1.0,
        respondPressure: 0.8,
        openingInitiative: 0.5,
        counterBonus: 0.4,
        holdJoker: 0.3,
        randomness: 0.6
      },
      effectWeights: {
        eightCut: 0.8,
        tenDiscard: 0.6,
        sevenGive: 0.4,
        queenPurge: 0.7,
        jackReverse: 0.6,
        nineReverse: 0.6,
        joker: 0.7
      },
      thresholds: {
        pass: -0.1
      },
      effectPreferences: {
        sevenGive: 'balanced',
        tenDiscard: 'highest',
        queenPurge: 'highest'
      },
      optionalEffectUsage: {
        sevenGive: 0.8,
        tenDiscard: 0.75
      }
    }
  },
  {
    id: 'infj',
    name: 'INFJ',
    mbtiType: 'INFJ',
    roleDescription: '他者の心理を読み、静かに支配する深読みプレイヤー',
    strategy: {
      weights: {
        base: -0.2,
        aggression: 0.45,
        conserveHigh: 0.7,
        lowCardBias: 0.5,
        combo: 0.45,
        keepTurn: 0.4,
        revolution: 0.4,
        finish: 0.9,
        respondPressure: 0.6,
        openingInitiative: 0.25,
        counterBonus: 0.6,
        holdJoker: 0.8,
        randomness: 0.1
      },
      effectWeights: {
        eightCut: 0.3,
        tenDiscard: 0.7,
        sevenGive: -0.1,
        queenPurge: 0.7,
        jackReverse: 0.3,
        nineReverse: 0.1,
        joker: 0.2
      },
      thresholds: {
        pass: 0.3
      },
      effectPreferences: {
        sevenGive: 'lowest',
        tenDiscard: 'highest',
        queenPurge: 'rarest'
      },
      optionalEffectUsage: {
        sevenGive: 0.4,
        tenDiscard: 0.8
      }
    }
  },
  {
    id: 'enfj',
    name: 'ENFJ',
    mbtiType: 'ENFJ',
    roleDescription: '他者を巻き込みながら勝ちに向かう社交プレイヤー',
    strategy: {
      weights: {
        base: -0.05,
        aggression: 0.55,
        conserveHigh: 0.45,
        lowCardBias: 0.45,
        combo: 0.6,
        keepTurn: 0.5,
        revolution: 0.4,
        finish: 1.0,
        respondPressure: 0.6,
        openingInitiative: 0.4,
        counterBonus: 0.45,
        holdJoker: 0.6,
        randomness: 0.2
      },
      effectWeights: {
        eightCut: 0.4,
        tenDiscard: 0.6,
        sevenGive: 0.2,
        queenPurge: 0.6,
        jackReverse: 0.4,
        nineReverse: 0.2,
        joker: 0.3
      },
      thresholds: {
        pass: 0.15
      },
      effectPreferences: {
        sevenGive: 'balanced',
        tenDiscard: 'highest',
        queenPurge: 'common'
      },
      optionalEffectUsage: {
        sevenGive: 0.65,
        tenDiscard: 0.8
      }
    }
  },
  {
    id: 'infp',
    name: 'INFP',
    mbtiType: 'INFP',
    roleDescription: '自分なりの美学を持って勝ちを目指すクリエイティブプレイヤー',
    strategy: {
      weights: {
        base: -0.25,
        aggression: 0.4,
        conserveHigh: 0.6,
        lowCardBias: 0.5,
        combo: 0.35,
        keepTurn: 0.3,
        revolution: 0.45,
        finish: 0.8,
        respondPressure: 0.45,
        openingInitiative: 0.2,
        counterBonus: 0.4,
        holdJoker: 0.7,
        randomness: 0.25
      },
      effectWeights: {
        eightCut: 0.2,
        tenDiscard: 0.5,
        sevenGive: -0.2,
        queenPurge: 0.6,
        jackReverse: 0.4,
        nineReverse: 0.1,
        joker: 0.3
      },
      thresholds: {
        pass: 0.35
      },
      effectPreferences: {
        sevenGive: 'lowest',
        tenDiscard: 'balanced',
        queenPurge: 'common'
      },
      optionalEffectUsage: {
        sevenGive: 0.3,
        tenDiscard: 0.6
      }
    }
  },
  {
    id: 'enfp',
    name: 'ENFP',
    mbtiType: 'ENFP',
    roleDescription: '盛り上げ役でありながら勝利も狙う自由奔放プレイヤー',
    strategy: {
      weights: {
        base: 0,
        aggression: 0.65,
        conserveHigh: 0.25,
        lowCardBias: 0.35,
        combo: 0.65,
        keepTurn: 0.8,
        revolution: 0.5,
        finish: 0.95,
        respondPressure: 0.7,
        openingInitiative: 0.55,
        counterBonus: 0.35,
        holdJoker: 0.4,
        randomness: 0.55
      },
      effectWeights: {
        eightCut: 0.7,
        tenDiscard: 0.5,
        sevenGive: 0.4,
        queenPurge: 0.7,
        jackReverse: 0.5,
        nineReverse: 0.5,
        joker: 0.6
      },
      thresholds: {
        pass: 0
      },
      effectPreferences: {
        sevenGive: 'balanced',
        tenDiscard: 'highest',
        queenPurge: 'highest'
      },
      optionalEffectUsage: {
        sevenGive: 0.75,
        tenDiscard: 0.7
      }
    }
  },
  {
    id: 'istj',
    name: 'ISTJ',
    mbtiType: 'ISTJ',
    roleDescription: '定石・経験則を重視する堅実プレイヤー',
    strategy: {
      weights: {
        base: -0.3,
        aggression: 0.35,
        conserveHigh: 0.85,
        lowCardBias: 0.55,
        combo: 0.4,
        keepTurn: 0.35,
        revolution: 0.3,
        finish: 0.9,
        respondPressure: 0.6,
        openingInitiative: 0.25,
        counterBonus: 0.55,
        holdJoker: 0.9,
        randomness: 0.05
      },
      effectWeights: {
        eightCut: 0.3,
        tenDiscard: 0.6,
        sevenGive: -0.3,
        queenPurge: 0.4,
        jackReverse: 0.2,
        nineReverse: 0,
        joker: 0.1
      },
      thresholds: {
        pass: 0.4
      },
      effectPreferences: {
        sevenGive: 'lowest',
        tenDiscard: 'highest',
        queenPurge: 'rarest'
      },
      optionalEffectUsage: {
        sevenGive: 0.25,
        tenDiscard: 0.7
      }
    }
  },
  {
    id: 'estj',
    name: 'ESTJ',
    mbtiType: 'ESTJ',
    roleDescription: '場を仕切りつつ勝利を追求するリーダー型プレイヤー',
    strategy: {
      weights: {
        base: -0.05,
        aggression: 0.7,
        conserveHigh: 0.4,
        lowCardBias: 0.3,
        combo: 0.7,
        keepTurn: 0.65,
        revolution: 0.45,
        finish: 1.05,
        respondPressure: 0.75,
        openingInitiative: 0.5,
        counterBonus: 0.45,
        holdJoker: 0.5,
        randomness: 0.15
      },
      effectWeights: {
        eightCut: 0.6,
        tenDiscard: 0.7,
        sevenGive: 0.3,
        queenPurge: 0.5,
        jackReverse: 0.3,
        nineReverse: 0.3,
        joker: 0.4
      },
      thresholds: {
        pass: 0.1
      },
      effectPreferences: {
        sevenGive: 'highest',
        tenDiscard: 'highest',
        queenPurge: 'highest'
      },
      optionalEffectUsage: {
        sevenGive: 0.7,
        tenDiscard: 0.85
      }
    }
  },
  {
    id: 'isfj',
    name: 'ISFJ',
    mbtiType: 'ISFJ',
    roleDescription: '他者・場を気遣いながらも勝利を狙う守護者型プレイヤー',
    strategy: {
      weights: {
        base: -0.3,
        aggression: 0.35,
        conserveHigh: 0.8,
        lowCardBias: 0.55,
        combo: 0.35,
        keepTurn: 0.3,
        revolution: 0.25,
        finish: 0.85,
        respondPressure: 0.5,
        openingInitiative: 0.2,
        counterBonus: 0.6,
        holdJoker: 0.85,
        randomness: 0.1
      },
      effectWeights: {
        eightCut: 0.2,
        tenDiscard: 0.6,
        sevenGive: -0.2,
        queenPurge: 0.5,
        jackReverse: 0.2,
        nineReverse: 0.1,
        joker: 0.2
      },
      thresholds: {
        pass: 0.35
      },
      effectPreferences: {
        sevenGive: 'lowest',
        tenDiscard: 'balanced',
        queenPurge: 'rarest'
      },
      optionalEffectUsage: {
        sevenGive: 0.35,
        tenDiscard: 0.65
      }
    }
  },
  {
    id: 'esfj',
    name: 'ESFJ',
    mbtiType: 'ESFJ',
    roleDescription: '社交的・明朗に勝利を狙う場馴染み型プレイヤー',
    strategy: {
      weights: {
        base: -0.1,
        aggression: 0.5,
        conserveHigh: 0.5,
        lowCardBias: 0.45,
        combo: 0.55,
        keepTurn: 0.45,
        revolution: 0.35,
        finish: 0.95,
        respondPressure: 0.55,
        openingInitiative: 0.45,
        counterBonus: 0.4,
        holdJoker: 0.55,
        randomness: 0.25
      },
      effectWeights: {
        eightCut: 0.4,
        tenDiscard: 0.6,
        sevenGive: 0.1,
        queenPurge: 0.5,
        jackReverse: 0.3,
        nineReverse: 0.2,
        joker: 0.3
      },
      thresholds: {
        pass: 0.2
      },
      effectPreferences: {
        sevenGive: 'balanced',
        tenDiscard: 'balanced',
        queenPurge: 'common'
      },
      optionalEffectUsage: {
        sevenGive: 0.6,
        tenDiscard: 0.7
      }
    }
  },
  {
    id: 'istp',
    name: 'ISTP',
    mbtiType: 'ISTP',
    roleDescription: '現場で即断・機転を利かせて勝つアクション型プレイヤー',
    strategy: {
      weights: {
        base: -0.05,
        aggression: 0.7,
        conserveHigh: 0.3,
        lowCardBias: 0.3,
        combo: 0.45,
        keepTurn: 0.7,
        revolution: 0.35,
        finish: 0.9,
        respondPressure: 0.8,
        openingInitiative: 0.4,
        counterBonus: 0.7,
        holdJoker: 0.45,
        randomness: 0.3
      },
      effectWeights: {
        eightCut: 0.7,
        tenDiscard: 0.5,
        sevenGive: 0.3,
        queenPurge: 0.4,
        jackReverse: 0.2,
        nineReverse: 0.5,
        joker: 0.5
      },
      thresholds: {
        pass: 0
      },
      effectPreferences: {
        sevenGive: 'highest',
        tenDiscard: 'highest',
        queenPurge: 'highest'
      },
      optionalEffectUsage: {
        sevenGive: 0.65,
        tenDiscard: 0.8
      }
    }
  },
  {
    id: 'estp',
    name: 'ESTP',
    mbtiType: 'ESTP',
    roleDescription: '勢い・流れを重視して勝つ刺激型プレイヤー',
    strategy: {
      weights: {
        base: 0.1,
        aggression: 0.85,
        conserveHigh: 0.2,
        lowCardBias: 0.25,
        combo: 0.6,
        keepTurn: 0.85,
        revolution: 0.4,
        finish: 1.0,
        respondPressure: 0.85,
        openingInitiative: 0.55,
        counterBonus: 0.35,
        holdJoker: 0.35,
        randomness: 0.5
      },
      effectWeights: {
        eightCut: 0.8,
        tenDiscard: 0.6,
        sevenGive: 0.4,
        queenPurge: 0.5,
        jackReverse: 0.4,
        nineReverse: 0.6,
        joker: 0.7
      },
      thresholds: {
        pass: -0.05
      },
      effectPreferences: {
        sevenGive: 'highest',
        tenDiscard: 'highest',
        queenPurge: 'highest'
      },
      optionalEffectUsage: {
        sevenGive: 0.8,
        tenDiscard: 0.75
      }
    }
  },
  {
    id: 'isfp',
    name: 'ISFP',
    mbtiType: 'ISFP',
    roleDescription: '自分のペース・感覚を大切にする柔軟型プレイヤー',
    strategy: {
      weights: {
        base: -0.25,
        aggression: 0.4,
        conserveHigh: 0.7,
        lowCardBias: 0.5,
        combo: 0.3,
        keepTurn: 0.35,
        revolution: 0.3,
        finish: 0.8,
        respondPressure: 0.45,
        openingInitiative: 0.2,
        counterBonus: 0.4,
        holdJoker: 0.75,
        randomness: 0.2
      },
      effectWeights: {
        eightCut: 0.3,
        tenDiscard: 0.5,
        sevenGive: -0.1,
        queenPurge: 0.4,
        jackReverse: 0.2,
        nineReverse: 0.1,
        joker: 0.2
      },
      thresholds: {
        pass: 0.35
      },
      effectPreferences: {
        sevenGive: 'lowest',
        tenDiscard: 'balanced',
        queenPurge: 'rarest'
      },
      optionalEffectUsage: {
        sevenGive: 0.3,
        tenDiscard: 0.55
      }
    }
  },
  {
    id: 'esfp',
    name: 'ESFP',
    mbtiType: 'ESFP',
    roleDescription: '盛り上げつつ勝ちを狙うショーマン型プレイヤー',
    strategy: {
      weights: {
        base: 0,
        aggression: 0.7,
        conserveHigh: 0.25,
        lowCardBias: 0.3,
        combo: 0.6,
        keepTurn: 0.75,
        revolution: 0.35,
        finish: 0.95,
        respondPressure: 0.75,
        openingInitiative: 0.55,
        counterBonus: 0.35,
        holdJoker: 0.3,
        randomness: 0.55
      },
      effectWeights: {
        eightCut: 0.7,
        tenDiscard: 0.6,
        sevenGive: 0.3,
        queenPurge: 0.6,
        jackReverse: 0.4,
        nineReverse: 0.4,
        joker: 0.8
      },
      thresholds: {
        pass: -0.05
      },
      effectPreferences: {
        sevenGive: 'balanced',
        tenDiscard: 'highest',
        queenPurge: 'highest'
      },
      optionalEffectUsage: {
        sevenGive: 0.75,
        tenDiscard: 0.7
      }
    }
  }
];
