'use client';

import clsx from 'clsx';
import Hand from './Hand';
import type { Card, Effect, Rank } from '@/lib/game/types';

interface EffectModalProps {
  effect: Effect;
  hand: Card[];
  selected: string[];
  limit: number;
  onToggleCard: (cardId: string) => void;
  onConfirm: () => void;
  onSkip?: () => void;
  loading: boolean;
  rank: Rank;
  onRankChange: (rank: Rank) => void;
}

const rankOptions: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const effectTitles: Record<Effect['type'], string> = {
  sevenGive: '7渡し',
  tenDiscard: '10捨て',
  queenPurge: 'Qボンバー',
  eightCut: '8切り',
  jackReverse: 'Jバック',
  jokerCounter: '♠3返し',
  nineReverse: '9リバース'
};

const EffectModal = ({
  effect,
  hand,
  selected,
  limit,
  onToggleCard,
  onConfirm,
  onSkip,
  loading,
  rank,
  onRankChange
}: EffectModalProps) => {
  const optional = Boolean(effect.payload?.optional);
  const remaining =
    typeof effect.payload?.remaining === 'number'
      ? effect.payload?.remaining
      : typeof effect.payload?.count === 'number'
      ? effect.payload?.count
      : 0;
  const declaredRanks = effect.payload?.declaredRanks ?? [];
  const isQueen = effect.type === 'queenPurge';
  const confirmDisabled = isQueen ? !rank : selected.length > limit;
  const useLightTheme =
    effect.type === 'sevenGive' || effect.type === 'tenDiscard' || effect.type === 'queenPurge';

  return (
    <div className="effect-overlay">
      <div className={clsx('effect-modal', useLightTheme && 'effect-modal-light')}>
        <h3 className="effect-title">{effectTitles[effect.type] ?? '効果'}</h3>
        <p className="effect-description">
          {effect.type === 'sevenGive'
            ? `最大${limit}枚まで次のプレイヤーに手札を渡せます。`
            : effect.type === 'tenDiscard'
            ? `最大${limit}枚まで好きなカードを捨てられます。`
            : '宣言したランクのカードを全員が捨てます。'}
        </p>
        {isQueen ? (
          <>
            <p className="effect-info">残り宣言回数: {remaining}</p>
            {declaredRanks.length ? (
              <p className="effect-info">宣言済み: {declaredRanks.join(', ')}</p>
            ) : null}
            <div className="effect-rank-grid">
              {rankOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={clsx('effect-rank-button', option === rank && 'effect-rank-selected')}
                  onClick={() => onRankChange(option)}
                  disabled={loading}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="effect-info">選択可能枚数: 0〜{limit}枚</p>
            <p className="effect-info">現在の選択: {selected.length}枚</p>
            <Hand cards={hand} selected={selected} onToggle={onToggleCard} />
          </>
        )}
        <div className="effect-actions">
          {optional ? (
            <button type="button" onClick={onSkip} disabled={loading} className="effect-button-secondary">
              何もしない
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || loading}
            className="effect-button-primary"
          >
            {loading ? '送信中…' : '決定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EffectModal;
