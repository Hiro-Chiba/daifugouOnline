'use client';

import type { Rank } from '@/lib/game/types';

export type EffectControlsProps =
  | {
      type: 'tenDiscard';
      maxCount: number;
      selectedCount: number;
      onExecute: () => void;
      onSkip: () => void;
      executeDisabled: boolean;
      skipDisabled: boolean;
      loading: boolean;
    }
  | {
      type: 'sevenGive';
      maxCount: number;
      selectedCount: number;
      onExecute: () => void;
      onSkip: () => void;
      executeDisabled: boolean;
      skipDisabled: boolean;
      loading: boolean;
      targetValue: string | null;
      onTargetChange: (value: string) => void;
      targetOptions: { id: string; name: string }[];
    }
  | {
      type: 'queenBomber';
      remaining: number;
      totalCount: number;
      selectedRank: Rank | '';
      onRankChange: (value: Rank | '') => void;
      onExecute: () => void;
      executeDisabled: boolean;
      loading: boolean;
      rankOptions: { value: Rank; label: string }[];
    };

interface ControlsProps {
  isMyTurn: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPass: () => void;
  loading: boolean;
  statusMessage?: string;
  effectControls?: EffectControlsProps;
}

const Controls = ({
  isMyTurn,
  canPlay,
  onPlay,
  onPass,
  loading,
  statusMessage,
  effectControls
}: ControlsProps) => {
  if (effectControls && isMyTurn) {
    if (effectControls.type === 'queenBomber') {
      const remainingLabel = `Qボンバー発動中：残り${effectControls.remaining}回（全${effectControls.totalCount}回）`;
      return (
        <div className="flex-column" style={{ marginTop: 16 }}>
          <div>{statusMessage ?? remainingLabel}</div>
          <label style={{ marginTop: 8, display: 'block' }}>
            宣言する数字:
            <select
              value={effectControls.selectedRank}
              onChange={(event) => effectControls.onRankChange(event.target.value as Rank)}
              style={{ marginLeft: 8 }}
            >
              <option value="">選択してください</option>
              {effectControls.rankOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex-column" style={{ flexDirection: 'row', gap: '12px', marginTop: 8 }}>
            <button
              type="button"
              onClick={effectControls.onExecute}
              disabled={effectControls.executeDisabled || effectControls.loading}
            >
              {effectControls.loading ? '処理中…' : '宣言する'}
            </button>
          </div>
        </div>
      );
    }

    const effectMessage =
      effectControls.type === 'tenDiscard'
        ? `10捨て発動中：最大${effectControls.maxCount}枚まで捨てられます`
        : `7渡し発動中：最大${effectControls.maxCount}枚まで渡せます`;
    const primaryLabel = effectControls.type === 'tenDiscard' ? '捨てる' : '渡す';
    return (
      <div className="flex-column" style={{ marginTop: 16 }}>
        <div>{statusMessage ?? effectMessage}</div>
        <div style={{ marginTop: 8 }}>選択中: {effectControls.selectedCount}枚 / 最大{effectControls.maxCount}枚</div>
        {effectControls.type === 'sevenGive' ? (
          <label style={{ marginTop: 8, display: 'block' }}>
            渡す相手:
            <select
              value={effectControls.targetValue ?? ''}
              onChange={(event) => effectControls.onTargetChange(event.target.value)}
              style={{ marginLeft: 8 }}
            >
              <option value="">選択してください</option>
              {effectControls.targetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex-column" style={{ flexDirection: 'row', gap: '12px', marginTop: 8 }}>
          <button
            type="button"
            onClick={effectControls.onExecute}
            disabled={effectControls.executeDisabled || effectControls.loading}
          >
            {effectControls.loading ? '処理中…' : primaryLabel}
          </button>
          <button
            type="button"
            onClick={effectControls.onSkip}
            disabled={effectControls.skipDisabled || effectControls.loading}
          >
            何もしない
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-column" style={{ marginTop: 16 }}>
      <div>{statusMessage ?? (isMyTurn ? 'あなたの手番です' : '相手の手番です')}</div>
      <div className="flex-column" style={{ flexDirection: 'row', gap: '12px' }}>
        <button type="button" onClick={onPlay} disabled={!isMyTurn || !canPlay || loading}>
          {loading ? '送信中…' : '出す'}
        </button>
        <button type="button" onClick={onPass} disabled={!isMyTurn || loading}>
          パス
        </button>
      </div>
    </div>
  );
};

export default Controls;
