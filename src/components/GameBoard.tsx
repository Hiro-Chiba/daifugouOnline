'use client';

import PlayerList from './PlayerList';
import Table from './Table';
import Hand from './Hand';
import Controls from './Controls';
import type { Card, PublicState } from '@/lib/game/types';

interface GameBoardProps {
  state: PublicState | null;
  selfPlayerId: string;
  hand: Card[];
  selected: string[];
  onToggle: (cardId: string) => void;
  onPlay: () => void;
  onPass: () => void;
  loading: boolean;
  connectionStatus: 'connected' | 'reconnecting';
}

const GameBoard = ({
  state,
  selfPlayerId,
  hand,
  selected,
  onToggle,
  onPlay,
  onPass,
  loading,
  connectionStatus
}: GameBoardProps) => {
  const players = state?.players ?? [];
  const selfPlayer = players.find((player) => player.id === selfPlayerId);
  const isMyTurn = state?.currentTurn === selfPlayerId;
  const cardMap = new Map(hand.map((card) => [card.id, card]));
  const selectionCards = selected
    .map((cardId) => cardMap.get(cardId))
    .filter((card): card is Card => Boolean(card));
  const uniqueRanks = new Set(selectionCards.map((card) => card.rank));
  const canPlay =
    selectionCards.length === selected.length &&
    selectionCards.length > 0 &&
    (uniqueRanks.size === 1 || (selectionCards.length === 1 && selectionCards[0]?.rank === 'Joker'));
  const statusMessage = state?.finished
    ? '対局は終了しました'
    : connectionStatus === 'reconnecting'
    ? '再接続中…'
    : undefined;
  const connectionLabel = connectionStatus === 'connected' ? '良好' : '再接続中';
  return (
    <div className="game-board">
      <div className="board-grid">
        <section className="table-panel">
          <div className="board-status">
            <span className="badge">参加者: {players.length}人</span>
            <span className={`badge badge-${connectionStatus}`}>接続: {connectionLabel}</span>
          </div>
          <div className="table-wrapper">
            <Table state={state} />
          </div>
        </section>
        <aside className="players-panel">
          <div className="players-header">
            <h3>参加者一覧</h3>
          </div>
          <PlayerList players={players} currentTurn={state?.currentTurn ?? null} />
        </aside>
      </div>
      <section className="hand-panel">
        <div className="hand-header">
          <h3>あなたの手札</h3>
          {selfPlayer ? <span className="hand-count">残り {selfPlayer.handCount}枚</span> : null}
        </div>
        <Hand cards={hand} selected={selected} onToggle={onToggle} />
        <Controls
          isMyTurn={Boolean(isMyTurn && selfPlayer && !selfPlayer.finished)}
          canPlay={canPlay}
          onPlay={onPlay}
          onPass={onPass}
          loading={loading}
          statusMessage={statusMessage}
        />
      </section>
    </div>
  );
};

export default GameBoard;
