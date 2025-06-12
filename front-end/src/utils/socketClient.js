import { io } from 'socket.io-client';

let socket;

export const initSocketClient = (userId, apiBaseUrl, onConnected = null) => {
  return new Promise((resolve, reject) => {
    if (!socket) {
      console.log('🚀 Creating new socket connection for user:', userId);
      socket = io(apiBaseUrl, {
        auth: { userId },
        transports: ['websocket', 'polling'],
        autoConnect: true, // Tự động kết nối khi khởi tạo
        reconnection: true, // Bật auto-reconnect
        reconnectionAttempts: Infinity, // Thử kết nối lại vô số lần
        reconnectionDelay: 1000, // Delay 1 giây giữa các lần thử
        reconnectionDelayMax: 5000, // Delay tối đa 5 giây
      });

      // Set timeout để tránh wait vô thời hạn
      const timeout = setTimeout(() => {
        console.error('❌ Socket connection timeout');
        reject(new Error('Socket connection timeout'));
      }, 10000); // 10 seconds timeout

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('🔗 Connected to Socket.IO server with userId:', userId);
        console.log('🎯 Socket ID:', socket.id);
        console.log('📤 Emitting register_user with userId:', userId);
        socket.emit('register_user', { userId });

        // Callback khi connected
        if (onConnected) {
          console.log('✅ Calling onConnected callback');
          onConnected();
        }

        console.log('✅ Socket initialization completed');
        resolve(socket);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Disconnected from Socket.IO server');
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Socket connection error:', error);
        reject(error);
      });
    } else {
      console.log('♻️ Reusing existing socket connection');
      // Nếu socket đã tồn tại và connected, gọi callback ngay
      if (socket.connected) {
        console.log('✅ Socket already connected, calling callback');
        if (onConnected) {
          onConnected();
        }
        resolve(socket);
      } else {
        // Nếu socket tồn tại nhưng chưa connected, đợi connect event
        const timeout = setTimeout(() => {
          console.error('❌ Socket reconnection timeout');
          reject(new Error('Socket reconnection timeout'));
        }, 5000);

        socket.once('connect', () => {
          clearTimeout(timeout);
          if (onConnected) {
            onConnected();
          }
          resolve(socket);
        });
      }
    }
  });
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
