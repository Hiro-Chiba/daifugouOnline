'use client';

import Image from 'next/image';
import type { Card, PublicState, Suit } from '@/lib/game/types';
import { getCardImagePath, getCardLabel } from '@/lib/game/cardAssets';

const describeCards = (cards: Card[]): string => cards.map(getCardLabel).join(' ');

const suitIconMap: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
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
      {state?.pendingEffects.length ? (
        <div className="table-effects">
          {state.pendingEffects.map((effect, index) => (
            <span className="table-effect-chip" key={`${effect.type}-${index}`}>
              {effect.type}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default Table;
