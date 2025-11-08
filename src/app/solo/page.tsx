'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import GameBoard from '@/components/GameBoard';
import Toast from '@/components/Toast';
import EffectModal from '@/components/EffectModal';
import {
  applyEffectAction,
  applyPass,
  applyPlay,
  createEmptyState,
  startGameIfReady,
  syncForClient
} from '@/lib/game/engine';
import { sortHand, type HandSortMode } from '@/lib/game/sort';
import type { Card, Effect, EffectAction, GameState, PublicState, Rank } from '@/lib/game/types';
import { NPC_DEFINITIONS } from '@/lib/singleplayer/npcs';
import type { ActiveNpc } from '@/lib/singleplayer/types';
import { executeNpcTurn } from '@/lib/singleplayer/ai';

const HUMAN_PLAYER_ID = 'solo-human';
const ROOM_CODE = 'solo-mode';
const queenRankOrder: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const getEffectSelectableCount = (effect: Effect | null): number => {
  if (!effect?.payload) {
    return 0;
  }
  if (typeof effect.payload.remaining === 'number') {
    return effect.payload.remaining;
  }
  if (typeof effect.payload.count === 'number') {
    return effect.payload.count;
  }
  return 0;
};

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
};

const SoloPage = () => {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('プレイヤー');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [activeNpcs, setActiveNpcs] = useState<ActiveNpc[]>([]);
  const [rawHand, setRawHand] = useState<Card[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [sortMode, setSortMode] = useState<HandSortMode>('none');
  const [selected, setSelected] = useState<string[]>([]);
  const [effectSelection, setEffectSelection] = useState<string[]>([]);
  const [effectRank, setEffectRank] = useState<Rank>('3');
  const [effectLoading, setEffectLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const effectSignatureRef = useRef<string | null>(null);

  const pushMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev.slice(-2), message]);
    window.setTimeout(() => {
      setMessages((prev) => prev.filter((item) => item !== message));
    }, 4000);
  }, []);

  useEffect(() => {
    if (!gameState) {
      setPublicState(null);
      setRawHand([]);
      setSelected([]);
      setEffectSelection([]);
      return;
    }
    const nextPublic = syncForClient(gameState, HUMAN_PLAYER_ID);
    setPublicState(nextPublic);
    const selfPlayer = gameState.players.find((player) => player.id === HUMAN_PLAYER_ID);
    const nextHand = selfPlayer?.hand ?? [];
    setRawHand(nextHand);
    setSelected((prev) => prev.filter((id) => nextHand.some((card) => card.id === id)));
    setEffectSelection((prev) => prev.filter((id) => nextHand.some((card) => card.id === id)));
  }, [gameState]);

  useEffect(() => {
    const reversed = publicState?.flags.strengthReversed ?? false;
    setHand(sortHand(rawHand, sortMode, { strengthReversed: reversed }));
  }, [publicState?.flags.strengthReversed, rawHand, sortMode]);

  const activeEffect = useMemo(() => {
    if (!publicState) {
      return null;
    }
    return (
      publicState.pendingEffects.find((effect) => {
        if (!effect.payload || effect.payload.playerId !== HUMAN_PLAYER_ID) {
          return false;
        }
        if (effect.type === 'sevenGive' || effect.type === 'tenDiscard') {
          return true;
        }
        if (effect.type === 'queenPurge') {
          const remaining =
            typeof effect.payload.remaining === 'number'
              ? effect.payload.remaining
              : typeof effect.payload.count === 'number'
              ? effect.payload.count
              : 0;
          return remaining > 0;
        }
        return false;
      }) ?? null
    );
  }, [publicState]);

  const effectLimit = useMemo(() => getEffectSelectableCount(activeEffect), [activeEffect]);

  useEffect(() => {
    if (!activeEffect) {
      effectSignatureRef.current = null;
      setEffectSelection([]);
      setEffectLoading(false);
      setEffectRank('3');
      return;
    }
    const signature = JSON.stringify({
      type: activeEffect.type,
      payload: activeEffect.payload ?? null
    });
    if (effectSignatureRef.current !== signature) {
      setEffectSelection([]);
      effectSignatureRef.current = signature;
    }
    setEffectLoading(false);
    if (activeEffect.type === 'queenPurge') {
      const declared = new Set(activeEffect.payload?.declaredRanks ?? []);
      if (declared.has(effectRank)) {
        const nextRank = queenRankOrder.find((rank) => !declared.has(rank)) ?? '3';
        setEffectRank(nextRank);
      }
    }
  }, [activeEffect, effectRank]);

  const npcMap = useMemo(() => {
    const map = new Map<string, ActiveNpc>();
    activeNpcs.forEach((npc) => {
      map.set(npc.playerId, npc);
    });
    return map;
  }, [activeNpcs]);

  useEffect(() => {
    if (!gameState || gameState.finished) {
      return;
    }
    const currentId = gameState.currentTurn;
    if (!currentId || currentId === HUMAN_PLAYER_ID) {
      return;
    }
    const npc = npcMap.get(currentId);
    if (!npc) {
      return;
    }
    const timer = window.setTimeout(() => {
      setGameState((prev) => {
        if (!prev || prev.currentTurn !== currentId) {
          return prev;
        }
        return executeNpcTurn(prev, npc);
      });
    }, 450 + Math.random() * 400);
    return () => window.clearTimeout(timer);
  }, [gameState, npcMap]);

  const toggleCard = useCallback((cardId: string) => {
    setSelected((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  }, []);

  const handleSortByStrength = useCallback(() => {
    setSortMode((prev) => (prev === 'strength' ? 'none' : 'strength'));
  }, []);

  const handleSortBySuit = useCallback(() => {
    setSortMode((prev) => (prev === 'suit' ? 'none' : 'suit'));
  }, []);

  const handleEffectCardToggle = useCallback(
    (cardId: string) => {
      if (!activeEffect) {
        return;
      }
      setEffectSelection((prev) => {
        if (prev.includes(cardId)) {
          return prev.filter((id) => id !== cardId);
        }
        if (
          (activeEffect.type === 'sevenGive' || activeEffect.type === 'tenDiscard') &&
          effectLimit > 0 &&
          prev.length >= effectLimit
        ) {
          pushMessage(`最大${effectLimit}枚まで選べます`);
          return prev;
        }
        return [...prev, cardId];
      });
    },
    [activeEffect, effectLimit, pushMessage]
  );

  const startBattle = useCallback(() => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      pushMessage('プレイヤー名を入力してください');
      return;
    }
    const npcPool = shuffle(NPC_DEFINITIONS).slice(0, 3);
    const seats = shuffle([1, 2, 3, 4]);
    const state = createEmptyState(ROOM_CODE);
    const humanSeat = seats[0];
    const npcInstances: ActiveNpc[] = npcPool.map((definition, index) => ({
      playerId: `npc-${definition.id}`,
      definition
    }));
    state.players = [
      {
        id: HUMAN_PLAYER_ID,
        name: trimmedName,
        seat: humanSeat,
        hand: [],
        connected: true,
        finished: false,
        result: null,
        hasPassed: false,
        ready: true
      },
      ...npcInstances.map((npc, idx) => ({
        id: npc.playerId,
        name: npc.definition.name,
        seat: seats[idx + 1],
        hand: [],
        connected: true,
        finished: false,
        result: null,
        hasPassed: false,
        ready: true
      }))
    ];
    const started = startGameIfReady(state);
    setPlayerName(trimmedName);
    setSortMode('none');
    setSelected([]);
    setEffectSelection([]);
    setActiveNpcs(npcInstances);
    setGameState(started);
    pushMessage('対戦を開始しました');
  }, [playerName, pushMessage]);

  const handlePlay = useCallback(() => {
    if (!gameState) {
      return;
    }
    const player = gameState.players.find((item) => item.id === HUMAN_PLAYER_ID);
    if (!player) {
      return;
    }
    const cardMap = new Map(player.hand.map((card) => [card.id, card]));
    const cards = selected
      .map((id) => cardMap.get(id))
      .filter((card): card is Card => Boolean(card));
    if (!cards.length) {
      pushMessage('カードを選択してください');
      return;
    }
    setActionLoading(true);
    const { state: nextState, result } = applyPlay(gameState, HUMAN_PLAYER_ID, cards);
    if (!result.ok) {
      pushMessage(result.reason);
      setActionLoading(false);
      return;
    }
    setSelected([]);
    setGameState(nextState);
    setActionLoading(false);
  }, [gameState, selected, pushMessage]);

  const handlePass = useCallback(() => {
    if (!gameState) {
      return;
    }
    setActionLoading(true);
    const nextState = applyPass(gameState, HUMAN_PLAYER_ID);
    setGameState(nextState);
    setActionLoading(false);
  }, [gameState]);

  const handleEffectSubmit = useCallback(
    (options?: { skip?: boolean }) => {
      if (!gameState || !activeEffect) {
        return;
      }
      if (
        (activeEffect.type === 'sevenGive' || activeEffect.type === 'tenDiscard') &&
        !options?.skip &&
        effectLimit > 0 &&
        effectSelection.length > effectLimit
      ) {
        pushMessage(`最大${effectLimit}枚まで選べます`);
        return;
      }
      setEffectLoading(true);
      let action: EffectAction;
      if (activeEffect.type === 'queenPurge') {
        action = { type: 'queenPurge', playerId: HUMAN_PLAYER_ID, rank: effectRank };
      } else if (activeEffect.type === 'sevenGive' || activeEffect.type === 'tenDiscard') {
        const limit = effectLimit > 0 ? effectLimit : effectSelection.length;
        const cards = options?.skip ? [] : effectSelection.slice(0, limit);
        action = { type: activeEffect.type, playerId: HUMAN_PLAYER_ID, cards };
      } else {
        pushMessage('この効果には対応できません');
        setEffectLoading(false);
        return;
      }
      const { state: nextState, result } = applyEffectAction(gameState, action);
      if (!result.ok) {
        pushMessage(result.reason);
        setEffectLoading(false);
        return;
      }
      setEffectSelection([]);
      setGameState(nextState);
      setEffectLoading(false);
    },
    [activeEffect, effectLimit, effectRank, effectSelection, gameState, pushMessage]
  );

  const handleRankChange = useCallback((rank: Rank) => {
    setEffectRank(rank);
  }, []);

  const handleRematch = useCallback(() => {
    startBattle();
  }, [startBattle]);

  const handleExit = useCallback(() => {
    setGameState(null);
    setActiveNpcs([]);
    router.push('/');
  }, [router]);

  const hasActiveGame = Boolean(publicState);

  return (
    <div className="solo-container">
      <section className="form-card solo-setup-card">
        <h1 className="solo-title">一人対戦モード</h1>
        <p className="solo-description">ランダムに選ばれた3体のNPCと大富豪で対決します。</p>
        <div className="solo-form">
          <label className="solo-label" htmlFor="player-name">
            プレイヤー名
          </label>
          <input
            id="player-name"
            className="solo-input"
            type="text"
            value={playerName}
            maxLength={20}
            onChange={(event) => setPlayerName(event.target.value)}
          />
          <button type="button" className="solo-start-button" onClick={startBattle}>
            {hasActiveGame ? '新しい対戦を開始' : '対戦開始'}
          </button>
        </div>
      </section>

      {hasActiveGame ? (
        <div className="solo-content">
          <section className="form-card solo-opponents" aria-label="対戦相手一覧">
            <h2>対戦相手</h2>
            <ul>
              {activeNpcs.map((npc) => (
                <li key={npc.playerId}>
                  <span className="solo-opponent-name">{npc.definition.name}</span>
                  <span className="solo-opponent-type">（{npc.definition.mbtiType}）</span>
                </li>
              ))}
            </ul>
          </section>
          <GameBoard
            state={publicState}
            selfPlayerId={HUMAN_PLAYER_ID}
            hand={hand}
            selected={selected}
            onToggle={toggleCard}
            onSortByStrength={handleSortByStrength}
            onSortBySuit={handleSortBySuit}
            sortMode={sortMode}
            onPlay={handlePlay}
            onPass={handlePass}
            loading={actionLoading}
            connectionStatus="connected"
          />
          <div className="solo-actions">
            <button type="button" className="solo-rematch-button" onClick={handleRematch}>
              もう一度戦う
            </button>
            <button type="button" className="solo-exit-button" onClick={handleExit}>
              終了
            </button>
          </div>
        </div>
      ) : null}

      {activeEffect ? (
        <EffectModal
          effect={activeEffect}
          hand={hand}
          selected={effectSelection}
          limit={effectLimit}
          onToggleCard={handleEffectCardToggle}
          onConfirm={() => handleEffectSubmit()}
          onSkip={activeEffect.payload?.optional ? () => handleEffectSubmit({ skip: true }) : undefined}
          loading={effectLoading}
          rank={effectRank}
          onRankChange={handleRankChange}
        />
      ) : null}

      <Toast messages={messages} />
    </div>
  );
};

export default SoloPage;
