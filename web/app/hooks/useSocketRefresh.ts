import { useEffect } from 'react';
import { socket } from '../lib/socket';

export function useSocketRefresh(events: string[], onRefresh: () => void) {
  useEffect(() => {
    socket.connect();
    
    events.forEach(event => {
      socket.on(event, onRefresh);
    });

    return () => {
      events.forEach(event => {
        socket.off(event, onRefresh);
      });
    };
  }, [events.join(','), onRefresh]);
}
