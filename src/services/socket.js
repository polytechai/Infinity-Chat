import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  transports: ["websocket", "polling"]
});

export const joinUser = (userId, userName) => {
  socket.emit("user:join", { userId, userName });
};

export const joinRoom = (roomId) => {
  socket.emit("chat:join_room", { roomId });
};

export const leaveRoom = (roomId) => {
  socket.emit("chat:leave_room", { roomId });
};

export const emitMessage = (message) => {
  socket.emit("message:send", message);
};

export const emitTyping = (roomId, userName, isTyping) => {
  socket.emit(isTyping ? "typing:start" : "typing:stop", { roomId, userName });
};

export const emitVote = (roomId, messageId, optionId, userId) => {
  socket.emit("poll:vote", { roomId, messageId, optionId, userId });
};

export const emitGameMove = (roomId, messageId, index, player) => {
  socket.emit("game:move", { roomId, messageId, index, player });
};
