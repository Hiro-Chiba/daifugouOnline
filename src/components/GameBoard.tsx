'use client';

import PlayerList from './PlayerList';
import Table from './Table';
import Hand from './Hand';
import Controls, { type EffectControlsProps } from './Controls';
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
  effectControls?: EffectControlsProps;
  statusMessageOverride?: string;
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
  connectionStatus,
  effectControls,
  statusMessageOverride
}: GameBoardProps) => {
  const players = state?.players ?? [];
  const selfPlayer = players.find((player) => player.id === selfPlayerId);
  const isMyTurn = state?.currentTurn === selfPlayerId;
  const isEffectExecutor = Boolean(effectControls && state?.activeEffect?.playerId === selfPlayerId);
  const cardMap = new Map(hand.map((card) => [card.id, card]));
  const selectionCards = selected
    .map((cardId) => cardMap.get(cardId))
    .filter((card): card is Card => Boolean(card));
  const nonJokerRanks = selectionCards
    .filter((card) => card.rank !== 'Joker')
    .map((card) => card.rank);
  const uniqueNonJokerRanks = new Set(nonJokerRanks);
  const hasUniformCombination =
    selectionCards.length > 0 &&
    (uniqueNonJokerRanks.size <= 1 || (selectionCards.length === 1 && selectionCards[0]?.rank === 'Joker'));
  const canPlay =
    !effectControls &&
    selectionCards.length === selected.length &&
    hasUniformCombination;
  const statusMessage =
    statusMessageOverride ??
    (state?.finished
      ? '対局は終了しました'
      : connectionStatus === 'reconnecting'
      ? '再接続中…'
      : undefined);
  return (
    <div className="game-board">
      <div className="board-grid">
        <section className="table-panel">
          <div className="board-status">
            <span className="badge">参加者: {players.length}人</span>
            <span className={`badge badge-${connectionStatus}`}>接続: {connectionLabel}</span>
          </div>
        </div>
        <div className="hand-section">
          <Hand cards={hand} selected={selected} onToggle={onToggle} />
          <Controls
            isMyTurn={Boolean((isMyTurn && selfPlayer && !selfPlayer.finished) || isEffectExecutor)}
            canPlay={canPlay}
            onPlay={onPlay}
            onPass={onPass}
            loading={loading}
            statusMessage={statusMessage}
            effectControls={effectControls}
          />
        </div>
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
