'use client';

import clsx from 'clsx';
import Image from 'next/image';
import type { Card } from '@/lib/game/types';
import { getCardImagePath, getCardLabel } from '@/lib/game/cardAssets';

interface HandProps {
  cards: Card[];
  selected: string[];
  onToggle: (cardId: string) => void;
}

const Hand = ({ cards, selected, onToggle }: HandProps) => (
  <div className="hand-section">
    <h3>あなたの手札</h3>
    <div className="card-grid">
      {cards.map((card) => {
        const isSelected = selected.includes(card.id);
        const imageClassName = clsx('card-face', isSelected && 'card-face-selected');
        return (
          <button
            key={card.id}
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
        );
      })}
    </div>
  </div>
);

export default Hand;
