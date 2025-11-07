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
  <div className="card-grid hand-grid">
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
            width={68}
            height={102}
            className={imageClassName}
          />
        </button>
      );
    })}
  </div>
);

export default Hand;
