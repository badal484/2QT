import { useEffect, useRef } from 'react';
import { socket } from '../lib/socket';

export function useSocketRefresh(events: string[], onRefresh: () => void) {
  // Stable ref so reconnect handler always calls the latest onRefresh
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    socket.connect();

    const playAlert = () => {
      try {
        const audio = new Audio('/alert.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    };

    // Keep handler references so socket.off removes only this hook's listeners,
    // not every other component that registered the same event.
    const boundHandlers: Array<[string, () => void]> = events.map(event => [
      event,
      () => {
        if (event === 'new_order') playAlert();
        onRefreshRef.current();
      },
    ]);

    // Re-fetch on reconnect so missed events during disconnect don't leave stale UI
    const handleReconnect = () => onRefreshRef.current();

    boundHandlers.forEach(([event, fn]) => socket.on(event, fn));
    socket.on('connect', handleReconnect);

    // 5-second poll as universal safety net for missed socket events
    const pollId = setInterval(() => onRefreshRef.current(), 5000);

    return () => {
      boundHandlers.forEach(([event, fn]) => socket.off(event, fn));
      socket.off('connect', handleReconnect);
      clearInterval(pollId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.join(',')]);
}
