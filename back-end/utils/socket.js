const { Server } = require('socket.io');

let io;

function initSocket(server) {
  console.log('Initializing Socket.IO server...');
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        console.log('CORS origin check:', origin); // Debug CORS
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://web-pro-plan.vercel.app',
          'https://planning-project-web-application.onrender.com',
        ];
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          origin.endsWith('.vercel.app')
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register_user', async ({ userId }) => {
      if (!userId) {
        console.warn('Invalid userId during registration');
        return;
      }
      socket.join(userId);
      console.log(`User ${userId} joined room ${userId}`);

      try {
        const groups = await poolQuery(
          `SELECT "groupId" FROM "users_groups" WHERE "userId" = $1`,
          [userId]
        );
        const groupIds = groups.map((g) => g.groupId);
        // join user vào các room của các group thuộc về user đó
        groupIds.forEach((groupId) => {
          socket.join(`group_${groupId}`);
          console.log(`User ${userId} joined room group_${groupId}`);
        });
      } catch (error) {
        console.error(
          `Error joining group rooms for user ${userId}:`,
          error.message
        );
      }
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

module.exports = { initSocket, getIO };
