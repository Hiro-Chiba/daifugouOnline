'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Card, PublicState, Suit, Effect, Play, QueenPurgeResult } from '@/lib/game/types';
import { getCardImagePath, getCardLabel } from '@/lib/game/cardAssets';

const describeCards = (cards: Card[]): string => cards.map(getCardLabel).join(' ');

const suitIconMap: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
};

const effectLabelMap: Record<Effect['type'], string> = {
  sevenGive: '7渡し',
  tenDiscard: '10捨て',
  queenPurge: 'Qボンバー',
  eightCut: '8切り',
  jackReverse: 'Jバック',
  jokerCounter: '♠3返し',
  nineReverse: '9リバース'
};

const getEffectKey = (effect: Effect): string =>
  `${effect.type}:${JSON.stringify(effect.payload ?? {})}`;

const describeEffect = (effect: Effect): string => {
  const base = effectLabelMap[effect.type] ?? effect.type;
  if (effect.type === 'sevenGive' || effect.type === 'tenDiscard') {
    const count = typeof effect.payload?.count === 'number' ? effect.payload.count : 0;
    return count > 0 ? `${base} (${count}枚)` : base;
  }
  if (effect.type === 'queenPurge') {
    const remaining =
      typeof effect.payload?.remaining === 'number'
        ? effect.payload.remaining
        : typeof effect.payload?.count === 'number'
        ? effect.payload.count
        : 0;
    return remaining > 0 ? `${base} 残り${remaining}` : base;
  }
  return base;
};

interface TableProps {
  state: PublicState | null;
}

const Table = ({ state }: TableProps) => {
  const [plays, setPlays] = useState<{ current: Play | null; previous: Play | null }>(
    { current: null, previous: null }
  );
  const [queenResult, setQueenResult] = useState<QueenPurgeResult | null>(null);
  const [visibleEffects, setVisibleEffects] = useState<Effect[]>([]);
  const effectTimerRef = useRef<number | null>(null);
  const previousEffectsRef = useRef<Effect[]>([]);
  const lastPlay = state?.table.lastPlay ?? null;
  const latestQueenResult = state?.table.queenPurgeResult ?? null;
  const queenPlayerId = latestQueenResult?.playerId ?? null;
  const queenRank = latestQueenResult?.rank ?? null;
  const queenCount = latestQueenResult?.count ?? null;
  const queenTimestamp = latestQueenResult?.timestamp ?? null;

  useEffect(() => {
    setPlays((prev) => {
      if (!lastPlay) {
        return { current: null, previous: null };
      }
      if (prev.current && prev.current.timestamp === lastPlay.timestamp) {
        return prev;
      }
      return { current: lastPlay, previous: prev.current ?? prev.previous ?? null };
    });
  }, [lastPlay]);

  useEffect(() => {
    if (!queenPlayerId || !queenRank || queenTimestamp === null || queenCount === null) {
      setQueenResult(null);
      return;
    }
    const current: QueenPurgeResult = {
      playerId: queenPlayerId,
      rank: queenRank,
      count: queenCount,
      timestamp: queenTimestamp
    };
    setQueenResult(current);
    const timer = window.setTimeout(() => {
      setQueenResult((prev) => (prev && prev.timestamp === queenTimestamp ? null : prev));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [queenPlayerId, queenRank, queenCount, queenTimestamp]);

  useEffect(() => {
    const effects = state?.pendingEffects ?? [];
    const previousEffects = previousEffectsRef.current;
    const previousKeys = new Set(previousEffects.map(getEffectKey));
    const newEffects = effects.filter((effect) => !previousKeys.has(getEffectKey(effect)));

    if (newEffects.length > 0) {
      setVisibleEffects(newEffects);
      if (effectTimerRef.current !== null) {
        window.clearTimeout(effectTimerRef.current);
      }
      effectTimerRef.current = window.setTimeout(() => {
        setVisibleEffects([]);
        effectTimerRef.current = null;
      }, 4000);
    } else if (effects.length === 0 && newEffects.length === 0 && previousEffects.length > 0) {
      // 効果が全て解消された場合は表示もクリアする
      if (effectTimerRef.current !== null) {
        window.clearTimeout(effectTimerRef.current);
        effectTimerRef.current = null;
      }
      setVisibleEffects([]);
    }

    previousEffectsRef.current = effects.map((effect) => ({
      type: effect.type,
      payload: effect.payload ? { ...effect.payload } : undefined
    }));
  }, [state?.pendingEffects]);

  useEffect(
    () => () => {
      if (effectTimerRef.current !== null) {
        window.clearTimeout(effectTimerRef.current);
      }
    },
    []
  );

  const currentPlay = plays.current;
  const previousPlay = plays.previous;
  const getPlayerName = (playerId: string) =>
    state?.players.find((player) => player.id === playerId)?.name ?? '不明なプレイヤー';
  const revolutionActive = state?.flags.revolutionActive ?? false;
  const strengthReversed = state?.flags.strengthReversed ?? false;
  const revolutionReversed = revolutionActive && strengthReversed;
  const tableClassName = [
    'table-display',
    'table-display-round',
    revolutionReversed ? 'table-display-revolution' : null
  ]
    .filter(Boolean)
    .join(' ');
  const strengthStatus = (() => {
    if (!state) {
      return '不明';
    }
    if (state.flags.strengthReversed) {
      return state.flags.revolutionActive ? '逆転中（革命）' : '逆転中';
    }
    return state.flags.revolutionActive ? '通常（革命一時解除）' : '通常';
  })();

  return (
    <div className={tableClassName}>
      <div className="table-pile">
        <h3 className="table-title">現在の場</h3>
        {currentPlay ? (
          <>
            <p className="table-summary">
              {getPlayerName(currentPlay.playerId)}が{currentPlay.cards.length}枚出しました
              （{describeCards(currentPlay.cards)}）
            </p>
            <div className="table-cards table-cards-current">
              {currentPlay.cards.map((card) => (
                <Image
                  key={card.id}
                  src={getCardImagePath(card)}
                  alt={getCardLabel(card)}
                  width={96}
                  height={144}
                  className="card-face table-card-face table-card-face-current"
                />
              ))}
            </div>
          </>
        ) : (
          <p className="table-summary">現在は場が流れています</p>
        )}
      </div>
      {previousPlay ? (
        <div className="table-previous">
          <span className="table-subtitle">一つ前の手</span>
          <p className="table-summary table-summary-muted">
            {getPlayerName(previousPlay.playerId)}が{previousPlay.cards.length}枚出しました
            （{describeCards(previousPlay.cards)}）
          </p>
          <div className="table-cards table-cards-previous">
            {previousPlay.cards.map((card) => (
              <Image
                key={`${previousPlay.timestamp}-${card.id}`}
                src={getCardImagePath(card)}
                alt={getCardLabel(card)}
                width={72}
                height={108}
                className="card-face table-card-face table-card-face-previous"
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="table-flags">
        <span>強さ順: {strengthStatus}</span>
        <span>
          縛り: {state?.flags.lockSuit ? `${suitIconMap[state.flags.lockSuit]}縛り` : 'なし'}
        </span>
        {state?.flags.awaitingSpade3 ? (
          <span className="table-alert">ジョーカー待ち：♠3のみ返せます</span>
        ) : null}
      </div>
      {queenResult ? (
        <div className="table-queen-banner" role="status">
          <strong>Qボンバー</strong>
          <span>
            {getPlayerName(queenResult.playerId)}が「{queenResult.rank}」を宣言し、
            {queenResult.count}枚のカードが捨てられました
          </span>
        </div>
      ) : null}
      {visibleEffects.length ? (
        <div className="table-effects">
          {visibleEffects.map((effect, index) => (
            <span className="table-effect-chip" key={`${getEffectKey(effect)}-${index}`}>
              {describeEffect(effect)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default Table;
