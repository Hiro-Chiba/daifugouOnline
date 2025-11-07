'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameBoard from '@/components/GameBoard';
import type { EffectControlsProps } from '@/components/Controls';
import Toast from '@/components/Toast';
import { getPusherClient } from '@/lib/pusher-client';
import { MIN_PLAYERS, MAX_PLAYERS } from '@/lib/game/constants';
import type { Card, PublicState, Rank } from '@/lib/game/types';
import { clearSession, loadSession, saveSession } from '@/lib/session';

interface SyncResponse {
  state: PublicState;
}

interface PlayResponse {
  state: PublicState;
}

interface StartResponse {
  state: PublicState;
}

interface LeaveResponse {
  state: PublicState;
}

const queenSelectableRanks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const queenRankOptionsList = queenSelectableRanks.map((rank) => ({ value: rank, label: rank }));

const hydrateState = (state: PublicState, userId: string, handOverride?: Card[]): PublicState => ({
  ...state,
  players: state.players.map((player) => {
    if (player.id === userId) {
      const hand = handOverride ?? player.hand ?? [];
      return {
        ...player,
        isSelf: true,
        hand,
        handCount: hand.length
      };
    }
    return {
      ...player,
      isSelf: false,
      hand: undefined
    };
  })
});

const RoomPage = () => {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const [state, setState] = useState<PublicState | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting'>('connected');
  const [effectLoading, setEffectLoading] = useState(false);
  const [effectTarget, setEffectTarget] = useState<string>('');
  const [effectRank, setEffectRank] = useState<Rank | ''>('');
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(true);

  const roomCode = useMemo(() => (typeof params.code === 'string' ? params.code : params.code?.[0] ?? ''), [params.code]);

  useEffect(() => {
    if (!session || session.roomCode !== roomCode) {
      const stored = loadSession();
      if (!stored || stored.roomCode !== roomCode) {
        router.replace('/');
        return;
      }
      setSession(stored);
    }
  }, [roomCode, router, session]);

  const pushMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev.slice(-2), message]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((item) => item !== message));
    }, 4000);
  }, []);

  const updateState = useCallback(
    (incoming: PublicState, handOverride?: Card[]) => {
      if (!session) {
        return;
      }
      const next = hydrateState(incoming, session.userId, handOverride ?? hand);
      setState(next);
    },
    [hand, session]
  );

  const syncState = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      if (!response.ok) {
        pushMessage('状態の取得に失敗しました');
        return;
      }
      const data = (await response.json()) as SyncResponse;
      const selfPlayer = data.state.players.find((player) => player.id === session.userId);
      const nextHand = (selfPlayer?.hand ?? []) as Card[];
      setHand(nextHand);
      setSelected((prev) => prev.filter((id) => nextHand.some((card) => card.id === id)));
      updateState(data.state, nextHand);
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    }
  }, [pushMessage, roomCode, session, updateState]);

  useEffect(() => {
    if (!session) {
      return;
    }
    syncState().catch(() => {
      pushMessage('同期に失敗しました');
    });
  }, [session, syncState, pushMessage]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const pusher = getPusherClient();
    const channelName = `presence-room-${roomCode}`;
    const channel = pusher.subscribe(channelName);

    const handleStateEvent = (payload: { state: PublicState; message?: string }) => {
      updateState(payload.state);
      if (payload.message) {
        pushMessage(payload.message);
      }
    };

    channel.bind('play-card', handleStateEvent);
    channel.bind('pass', handleStateEvent);
    channel.bind('player-joined', (payload: { name: string; state: PublicState }) => {
      updateState(payload.state);
      pushMessage(`${payload.name} さんが入室しました`);
    });
    channel.bind('player-left', (payload: { name: string; state?: PublicState }) => {
      if (payload.state) {
        updateState(payload.state);
      }
      pushMessage(`${payload.name} さんが退室しました`);
    });
    channel.bind('system-message', (payload: { message: string; state?: PublicState }) => {
      if (payload.state) {
        updateState(payload.state);
      }
      pushMessage(payload.message);
    });
    channel.bind('sync-state', (payload: { state: PublicState }) => {
      updateState(payload.state);
    });

    const connection = pusher.connection;
    const handleConnectionChange = (states: { current: string }) => {
      setConnectionStatus(states.current === 'connected' ? 'connected' : 'reconnecting');
    };
    connection.bind('state_change', handleConnectionChange);

    return () => {
      channel.unbind('play-card', handleStateEvent);
      channel.unbind('pass', handleStateEvent);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      connection.unbind('state_change', handleConnectionChange);
    };
  }, [roomCode, session, updateState, pushMessage]);

  const toggleCard = useCallback(
    (cardId: string) => {
      if (effectLoading) {
        return;
      }
      setSelected((prev) => {
        const isSelected = prev.includes(cardId);
        if (isSelected) {
          return prev.filter((id) => id !== cardId);
        }
        const activeEffect = state?.activeEffect;
        if (
          activeEffect &&
          session?.userId === activeEffect.playerId &&
          (activeEffect.type === 'tenDiscard' || activeEffect.type === 'sevenGive') &&
          prev.length >= activeEffect.maxCount
        ) {
          return prev;
        }
        return [...prev, cardId];
      });
    },
    [effectLoading, state, session]
  );

  const handlePlay = useCallback(async () => {
    if (!session || selected.length === 0) {
      return;
    }
    if (state?.activeEffect && state.activeEffect.playerId === session.userId) {
      pushMessage('効果を先に処理してください');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId, cards: selected })
      });
      const data = (await response.json()) as PlayResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? '出札に失敗しました');
        return;
      }
      const selfPlayer = data.state.players.find((player) => player.id === session.userId);
      const nextHand = (selfPlayer?.hand ?? []) as Card[];
      setHand(nextHand);
      setSelected([]);
      updateState(data.state, nextHand);
      saveSession({ ...session, roomCode });
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [roomCode, session, selected, state, updateState, pushMessage]);

  const handlePass = useCallback(async () => {
    if (!session) {
      return;
    }
    if (state?.activeEffect) {
      pushMessage('効果の処理を先に行ってください');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      const data = (await response.json()) as PlayResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? 'パスに失敗しました');
        return;
      }
      updateState(data.state);
      saveSession({ ...session, roomCode });
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [roomCode, session, state, updateState, pushMessage]);

  const handleEffectAction = useCallback(
    async (action: 'execute' | 'skip') => {
      if (!session || !state?.activeEffect || state.activeEffect.playerId !== session.userId) {
        return;
      }
      const activeEffect = state.activeEffect;
      const requiresTarget = activeEffect.type === 'sevenGive';
      const requiresCards = activeEffect.type === 'tenDiscard' || activeEffect.type === 'sevenGive';
      const requiresRank = activeEffect.type === 'queenBomber';
      if (action === 'execute') {
        if (requiresCards) {
          if (selected.length === 0) {
            pushMessage('カードを選択してください');
            return;
          }
          if (selected.length > activeEffect.maxCount) {
            pushMessage(`最大${activeEffect.maxCount}枚まで選択できます`);
            return;
          }
        }
        if (requiresTarget && !effectTarget) {
          pushMessage('渡す相手を選択してください');
          return;
        }
        if (requiresRank && !effectRank) {
          pushMessage('宣言する数字を選択してください');
          return;
        }
      }
      const cardsPayload =
        requiresCards && action === 'execute' ? selected : [];
      const targetPayload =
        requiresTarget && action === 'execute' ? effectTarget || undefined : undefined;
      const declaredRankPayload =
        requiresRank && action === 'execute' && effectRank ? effectRank : undefined;
      try {
        setEffectLoading(true);
        const response = await fetch('/api/effect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: roomCode,
            userId: session.userId,
            action,
            cards: cardsPayload,
            targetPlayerId: targetPayload,
            declaredRank: declaredRankPayload
          })
        });
        const data = (await response.json()) as PlayResponse & { error?: string };
        if (!response.ok) {
          pushMessage(data.error ?? '効果の処理に失敗しました');
          return;
        }
        const selfPlayer = data.state.players.find((player) => player.id === session.userId);
        const nextHand = (selfPlayer?.hand ?? []) as Card[];
        setHand(nextHand);
        setSelected([]);
        setEffectTarget('');
        setEffectRank('');
        updateState(data.state, nextHand);
      } catch (error) {
        pushMessage('通信エラーが発生しました');
      } finally {
        setEffectLoading(false);
      }
    },
    [
      session,
      state,
      selected,
      effectTarget,
      effectRank,
      roomCode,
      updateState,
      pushMessage
    ]
  );

  const handleTargetChange = useCallback((value: string) => {
    setEffectTarget(value);
  }, []);

  const handleRankChange = useCallback((value: string) => {
    if (value === '') {
      setEffectRank('');
      return;
    }
    setEffectRank(value as Rank);
  }, []);

  useEffect(() => {
    if (!session || !state?.activeEffect || state.activeEffect.playerId !== session.userId) {
      if (effectTarget) {
        setEffectTarget('');
      }
      if (effectRank) {
        setEffectRank('');
      }
      return;
    }
    if (state.activeEffect.type !== 'sevenGive') {
      if (effectTarget) {
        setEffectTarget('');
      }
    } else if (
      effectTarget &&
      !state.players.some(
        (player) => player.id === effectTarget && player.id !== session.userId && !player.finished
      )
    ) {
      setEffectTarget('');
    }
    if (state.activeEffect.type !== 'queenBomber' && effectRank) {
      setEffectRank('');
    }
  }, [state, session, effectTarget, effectRank]);

  const handleStartGame = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      setStartLoading(true);
      const response = await fetch('/api/rooms/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      const data = (await response.json()) as StartResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? 'ゲーム開始に失敗しました');
        return;
      }
      const selfPlayer = data.state.players.find((player) => player.id === session.userId);
      const nextHand = (selfPlayer?.hand ?? []) as Card[];
      setHand(nextHand);
      setSelected([]);
      updateState(data.state, nextHand);
      saveSession({ ...session, roomCode });
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setStartLoading(false);
    }
  }, [roomCode, session, updateState, pushMessage]);

  const handleLeaveRoom = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      setLeaveLoading(true);
      const response = await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      const data = (await response.json()) as LeaveResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? '退室に失敗しました');
        return;
      }
      clearSession();
      setSession(null);
      pushMessage('ルームを退出しました');
      router.replace('/');
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setLeaveLoading(false);
    }
  }, [roomCode, session, pushMessage, router]);

  const effectControls = useMemo<EffectControlsProps | undefined>(() => {
    if (!session || !state || !state.activeEffect || state.activeEffect.playerId !== session.userId) {
      return undefined;
    }
    const selectedCount = selected.length;
    if (state.activeEffect.type === 'tenDiscard') {
      const maxCount = state.activeEffect.maxCount;
      return {
        type: 'tenDiscard',
        maxCount,
        selectedCount,
        onExecute: () => handleEffectAction('execute'),
        onSkip: () => handleEffectAction('skip'),
        executeDisabled: selectedCount === 0 || selectedCount > maxCount,
        skipDisabled: false,
        loading: effectLoading
      };
    }
    if (state.activeEffect.type === 'sevenGive') {
      const maxCount = state.activeEffect.maxCount;
      const targetOptions = state.players
        .filter((player) => player.id !== session.userId && !player.finished)
        .map((player) => ({ id: player.id, name: player.name }));
      return {
        type: 'sevenGive',
        maxCount,
        selectedCount,
        onExecute: () => handleEffectAction('execute'),
        onSkip: () => handleEffectAction('skip'),
        executeDisabled:
          selectedCount === 0 ||
          selectedCount > maxCount ||
          !effectTarget ||
          targetOptions.length === 0,
        skipDisabled: false,
        loading: effectLoading,
        targetValue: effectTarget || null,
        onTargetChange: handleTargetChange,
        targetOptions
      };
    }
    if (state.activeEffect.type === 'queenBomber') {
      return {
        type: 'queenBomber',
        remaining: state.activeEffect.remaining,
        totalCount: state.activeEffect.totalCount,
        selectedRank: effectRank,
        onRankChange: handleRankChange,
        onExecute: () => handleEffectAction('execute'),
        executeDisabled: !effectRank,
        loading: effectLoading,
        rankOptions: queenRankOptionsList
      };
    }
    return undefined;
  }, [
    session,
    state,
    selected,
    handleEffectAction,
    effectLoading,
    effectTarget,
    handleTargetChange,
    effectRank,
    handleRankChange
  ]);

  const statusMessageOverride = useMemo(() => {
    if (!session || state?.finished || connectionStatus === 'reconnecting') {
      return undefined;
    }
    if (!state?.activeEffect) {
      return undefined;
    }
    return state.activeEffect.playerId === session.userId ? '効果を実行してください' : '効果処理待ちです';
  }, [session, state, connectionStatus]);

  if (!session) {
    return null;
  }

  const playersCount = state?.players.length ?? 0;
  const hasGameStarted = state?.players.some((player) => player.handCount > 0) ?? false;
  const canStartGame = !hasGameStarted && playersCount >= MIN_PLAYERS;
  const remainingPlayers = Math.max(0, MIN_PLAYERS - playersCount);
  const isRoomFull = playersCount >= MAX_PLAYERS;

  return (
    <div className="room-page">
      <section className={`room-info ${isInfoCollapsed ? 'room-info-collapsed' : ''}`}>
        <button
          type="button"
          className="room-info-toggle"
          onClick={() => setIsInfoCollapsed((prev) => !prev)}
          aria-expanded={!isInfoCollapsed}
        >
          <span className="room-info-label">ルーム情報</span>
          <span className="room-info-code">#{roomCode}</span>
          <span className="room-info-icon" aria-hidden="true">
            {isInfoCollapsed ? '＋' : '－'}
          </span>
        </button>
        <div className="room-info-body">
          <p>プレイヤー名: {session.name}</p>
          <div className="room-info-actions">
            <button type="button" onClick={handleStartGame} disabled={!canStartGame || startLoading}>
              {startLoading ? '開始中…' : 'ゲーム開始'}
            </button>
            <button type="button" onClick={handleLeaveRoom} disabled={leaveLoading}>
              {leaveLoading ? '退室中…' : 'ルームを退出'}
            </button>
          </div>
          {!hasGameStarted ? (
            playersCount < MIN_PLAYERS ? (
              <small className="room-info-hint">ゲーム開始にはあと{remainingPlayers}人必要です</small>
            ) : isRoomFull ? (
              <small className="room-info-hint">ルームは満員です（最大{MAX_PLAYERS}人まで参加できます）</small>
            ) : null
          ) : null}
        </div>
      </section>
      <GameBoard
        state={state}
        selfPlayerId={session.userId}
        hand={hand}
        selected={selected}
        onToggle={toggleCard}
        onPlay={handlePlay}
        onPass={handlePass}
        loading={loading}
        connectionStatus={connectionStatus}
        effectControls={effectControls}
        statusMessageOverride={statusMessageOverride}
      />
      <Toast messages={messages} />
    </div>
  );
};

export default RoomPage;
