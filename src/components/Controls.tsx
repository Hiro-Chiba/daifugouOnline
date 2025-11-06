'use client';

interface ControlsProps {
  isMyTurn: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPass: () => void;
  loading: boolean;
  statusMessage?: string;
}

const Controls = ({ isMyTurn, canPlay, onPlay, onPass, loading, statusMessage }: ControlsProps) => (
  <div className="controls">
    <div className="controls-status">{statusMessage ?? (isMyTurn ? 'あなたの手番です' : '相手の手番です')}</div>
    <div className="controls-buttons">
      <button type="button" onClick={onPlay} disabled={!isMyTurn || !canPlay || loading}>
        {loading ? '送信中…' : '出す'}
      </button>
      <button type="button" onClick={onPass} disabled={!isMyTurn || loading}>
        パス
      </button>
    </div>
  </div>
);

export default Controls;
