import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
};

export const socket: Socket = io(getSocketUrl(), {
  autoConnect: false,
  auth: (cb) => {
    cb({ token: typeof window !== "undefined" ? localStorage.getItem("2qt_token") : null });
  }
});

socket.on("connect_error", (err) => {
  console.warn("[Socket] Connection error:", err.message);
});

socket.on("error", (err) => {
  console.error("[Socket] Error:", err);
});
