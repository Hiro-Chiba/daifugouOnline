'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameBoard from '@/components/GameBoard';
import Toast from '@/components/Toast';
import { getPusherClient } from '@/lib/pusher-client';
import { MIN_PLAYERS, MAX_PLAYERS } from '@/lib/game/constants';
import type { Card, PublicState } from '@/lib/game/types';
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
      setSelected((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    },
    []
  );

  const handlePlay = useCallback(async () => {
    if (!session || selected.length === 0) {
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
  }, [roomCode, session, selected, updateState, pushMessage]);

  const handlePass = useCallback(async () => {
    if (!session) {
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
  }, [roomCode, session, updateState, pushMessage]);

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

  if (!session) {
    return null;
  }

  const playersCount = state?.players.length ?? 0;
  const hasGameStarted = state?.players.some((player) => player.handCount > 0) ?? false;
  const canStartGame = !hasGameStarted && playersCount >= MIN_PLAYERS;
  const remainingPlayers = Math.max(0, MIN_PLAYERS - playersCount);
  const isRoomFull = playersCount >= MAX_PLAYERS;

  return (
    <div className="flex-column">
      <header className="form-card" style={{ marginBottom: 16 }}>
        <h2>ルームコード: {roomCode}</h2>
        <p>プレイヤー名: {session.name}</p>
        <div
          className="flex-column"
          style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 12 }}
        >
          <button type="button" onClick={handleStartGame} disabled={!canStartGame || startLoading}>
            {startLoading ? '開始中…' : 'ゲーム開始'}
          </button>
          <button type="button" onClick={handleLeaveRoom} disabled={leaveLoading}>
            {leaveLoading ? '退室中…' : 'ルームを退出'}
          </button>
        </div>
        {!hasGameStarted ? (
          playersCount < MIN_PLAYERS ? (
            <small style={{ display: 'block', marginTop: 8 }}>
              ゲーム開始にはあと{remainingPlayers}人必要です
            </small>
          ) : isRoomFull ? (
            <small style={{ display: 'block', marginTop: 8 }}>
              ルームは満員です（最大{MAX_PLAYERS}人まで参加できます）
            </small>
          ) : null
        ) : null}
      </header>
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
      />
      <Toast messages={messages} />
    </div>
  );
};

export default RoomPage;
