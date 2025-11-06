'use client';

import clsx from 'clsx';
import type { Card } from '@/lib/game/types';

interface HandProps {
  cards: Card[];
  selected: string[];
  onToggle: (cardId: string) => void;
}

const suitIcon: Record<string, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
};

const Hand = ({ cards, selected, onToggle }: HandProps) => (
  <div className="hand-section">
    <h3>あなたの手札</h3>
    <div className="card-grid">
      {cards.map((card) => {
        const isSelected = selected.includes(card.id);
        return (
          <button
            key={card.id}
            type="button"
            className={clsx('card-item', isSelected && 'selected')}
            onClick={() => onToggle(card.id)}
          >
            {card.rank === 'Joker' ? '🃏' : `${suitIcon[card.suit] ?? ''}${card.rank}`}
          </button>
        );
      })}
    </div>
  </div>
);

export default Hand;
