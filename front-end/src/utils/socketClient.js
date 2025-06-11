import { io } from 'socket.io-client';

let socket;

export const initSocketClient = (userId, apiBaseUrl) => {
  if (!socket) {
    socket = io(apiBaseUrl, {
      auth: { userId },
      transports: ['websocket', 'polling'],
      autoConnect: true, // Tự động kết nối khi khởi tạo
      reconnection: true, // Bật auto-reconnect
      reconnectionAttempts: Infinity, // Thử kết nối lại vô số lần
      reconnectionDelay: 1000, // Delay 1 giây giữa các lần thử
      reconnectionDelayMax: 5000, // Delay tối đa 5 giây
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server with userId:', userId);
      socket.emit('register_user', { userId });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket.io client not initialized!');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
