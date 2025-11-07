'use client';

interface ControlsProps {
  isMyTurn: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPass: () => void;
  loading: boolean;
  statusMessage?: string;
  canPass: boolean;
}

const Controls = ({
  isMyTurn,
  canPlay,
  onPlay,
  onPass,
  loading,
  statusMessage,
  canPass
}: ControlsProps) => (
  <div className="controls">
    <div className="controls-status">{statusMessage ?? (isMyTurn ? 'あなたの手番です' : '相手の手番です')}</div>
    <div className="controls-buttons">
      <button type="button" onClick={onPlay} disabled={!isMyTurn || !canPlay || loading}>
        {loading ? '送信中…' : '出す'}
      </button>
      <button type="button" onClick={onPass} disabled={!isMyTurn || !canPass || loading}>
        パス
      </button>
    </div>
  </div>
);

export default Controls;
