import { useEffect, useRef } from 'react';
import { socket } from '../lib/socket';

export function useSocketRefresh(events: string[], onRefresh: () => void) {
  // Stable ref so reconnect handler always calls the latest onRefresh
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    socket.connect();

    const handler = () => onRefreshRef.current();

    // Re-fetch on reconnect so missed events during disconnect don't leave stale UI
    const handleReconnect = () => onRefreshRef.current();

    events.forEach(event => socket.on(event, handler));
    socket.on('connect', handleReconnect);

    return () => {
      events.forEach(event => socket.off(event, handler));
      socket.off('connect', handleReconnect);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.join(',')]);
}
