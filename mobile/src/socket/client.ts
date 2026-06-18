import { io, Socket } from 'socket.io-client';

import { ENV } from '../config/env';

const SOCKET_URL = ENV.SOCKET_URL;



let socket: Socket | null = null;

export const connectSocket = (token: string) => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    extraHeaders: {
      'Bypass-Tunnel-Reminder': 'true'
    }
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
