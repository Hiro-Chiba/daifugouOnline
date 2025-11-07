'use client';

import Image from 'next/image';
import type { Card, EffectPrompt, PublicState, Suit } from '@/lib/game/types';
import { getCardImagePath, getCardLabel } from '@/lib/game/cardAssets';

const describeCards = (cards: Card[]): string => cards.map(getCardLabel).join(' ');

const suitIconMap: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
};

const effectLabelMap: Record<EffectPrompt['type'], string> = {
  tenDiscard: '10捨て',
  sevenGive: '7渡し',
  queenBomber: 'Qボンバー'
};

const describeActiveEffect = (state: PublicState | null): string | null => {
  if (!state?.activeEffect) {
    return null;
  }
  const label = effectLabelMap[state.activeEffect.type] ?? state.activeEffect.type;
  const player = state.players.find((item) => item.id === state.activeEffect?.playerId);
  const name = player ? `${player.name} さんの` : '';
  if (state.activeEffect.type === 'tenDiscard') {
    return `${name}${label}発動中（最大${state.activeEffect.maxCount}枚捨てられます）`;
  }
  if (state.activeEffect.type === 'sevenGive') {
    return `${name}${label}発動中（最大${state.activeEffect.maxCount}枚渡せます）`;
  }
  if (state.activeEffect.type === 'queenBomber') {
    return `${name}${label}発動中（残り${state.activeEffect.remaining}回）`;
  }
  return `${name}${label}発動中`;
};

interface TableProps {
  state: PublicState | null;
}

const Table = ({ state }: TableProps) => {
  const lastPlay = state?.table.lastPlay;
  return (
    <div className="table-display">
      <h3 className="table-title">現在の場</h3>
      <div className="table-pile">
        {lastPlay ? (
          <>
            <p className="table-summary">
              {lastPlay.cards.length}枚 [{describeCards(lastPlay.cards)}]
            </p>
            <div className="table-cards">
              {lastPlay.cards.map((card) => (
                <Image
                  key={card.id}
                  src={getCardImagePath(card)}
                  alt={getCardLabel(card)}
                  width={96}
                  height={144}
                  className="card-face table-card-face"
                />
              ))}
            </div>
          </>
        ) : (
          <p className="table-summary">現在は場が流れています</p>
        )}
      </div>
      <div className="table-flags">
        <span>強さ順: {state?.flags.strengthReversed ? '逆転中' : '通常'}</span>
        <span>順番: {state?.flags.rotationReversed ? '逆回り' : '通常'}</span>
        {state?.flags.awaitingSpade3 ? (
          <span className="table-alert">ジョーカー待ち：♠3のみ返せます</span>
        ) : null}
      </div>
      {state?.activeEffect ? (
        <div className="table-effects">
          <span className="table-effect-chip">{describeActiveEffect(state)}</span>
        </div>
      ) : null}
    </div>
  );
};

export default Table;
