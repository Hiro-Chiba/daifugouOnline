'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { sortCardsByStrength } from '@/lib/game/deal';
import type { Card } from '@/lib/game/types';
import { getCardImagePath, getCardLabel } from '@/lib/game/cardAssets';

interface HandProps {
  cards: Card[];
  selected: string[];
  onToggle: (cardId: string) => void;
}

const Hand = ({ cards, selected, onToggle }: HandProps) => {
  const orderedCards = useMemo(() => sortCardsByStrength(cards), [cards]);
  const middle = (orderedCards.length - 1) / 2;
  const maxTilt = 14;
  const tiltStep = middle > 0 ? maxTilt / middle : 0;

  return (
    <div className="hand-section">
      <h3>あなたの手札</h3>
      <div className="hand-fan">
        {orderedCards.map((card, index) => {
          const offset = index - middle;
          const style: CSSProperties = {
            '--fan-rotate': `${offset * tiltStep}deg`,
            '--fan-depth': `${Math.abs(offset) * 6}px`,
            '--z-index': `${orderedCards.length + index}`
          };
          const isSelected = selected.includes(card.id);
          const imageClassName = clsx('card-face', isSelected && 'card-face-selected');
          const wrapperClassName = clsx('hand-card', isSelected && 'hand-card-selected');
          return (
            <div key={card.id} className={wrapperClassName} style={style}>
              <button
                type="button"
                className={clsx('card-item', isSelected && 'selected')}
                onClick={() => onToggle(card.id)}
              >
                <Image
                  src={getCardImagePath(card)}
                  alt={getCardLabel(card)}
                  width={72}
                  height={108}
                  className={imageClassName}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Hand;
