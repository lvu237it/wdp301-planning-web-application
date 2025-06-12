const { Server } = require('socket.io');
const Membership = require('../models/memberShipModel');
const BoardMembership = require('../models/boardMembershipModel');

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
        console.warn('⚠️ Invalid userId during registration');
        return;
      }
      socket.join(userId);
      console.log(`✅ User ${userId} joined personal room ${userId}`);

      try {
        // Join user vào các workspace rooms mà họ đã tham gia
        const workspaceMemberships = await Membership.find({
          userId: userId,
          isDeleted: false,
          invitationStatus: 'accepted', // Chỉ những workspace đã chấp nhận
        }).populate('workspaceId', '_id name');

        const workspaceIds = workspaceMemberships
          .filter(
            (membership) =>
              membership.workspaceId && !membership.workspaceId.isDeleted
          )
          .map((membership) => membership.workspaceId._id.toString());

        // Join user vào các workspace rooms
        workspaceIds.forEach((workspaceId) => {
          socket.join(`workspace_${workspaceId}`);
          console.log(
            `User ${userId} joined workspace room workspace_${workspaceId}`
          );
        });

        // Join user vào các board rooms mà họ đã tham gia
        const boardMemberships = await BoardMembership.find({
          userId: userId,
          isDeleted: false,
          applicationStatus: 'accepted', // Chỉ những board đã được chấp nhận
        }).populate('boardId', '_id name workspaceId');

        const boardIds = boardMemberships
          .filter(
            (membership) => membership.boardId && !membership.boardId.isDeleted
          )
          .map((membership) => membership.boardId._id.toString());

        // Join user vào các board rooms
        boardIds.forEach((boardId) => {
          socket.join(`board_${boardId}`);
          console.log(`User ${userId} joined board room board_${boardId}`);
        });

        console.log(
          `User ${userId} successfully joined ${workspaceIds.length} workspace rooms and ${boardIds.length} board rooms`
        );
      } catch (error) {
        console.error(
          `Error joining workspace/board rooms for user ${userId}:`,
          error.message
        );
      }
    });

    // Event handler cho việc join workspace mới
    socket.on('join_workspace', ({ userId, workspaceId }) => {
      if (!userId || !workspaceId) {
        console.warn('Invalid userId or workspaceId for join_workspace');
        return;
      }
      socket.join(`workspace_${workspaceId}`);
      console.log(
        `User ${userId} joined new workspace room workspace_${workspaceId}`
      );
    });

    // Event handler cho việc leave workspace
    socket.on('leave_workspace', ({ userId, workspaceId }) => {
      if (!userId || !workspaceId) {
        console.warn('Invalid userId or workspaceId for leave_workspace');
        return;
      }
      socket.leave(`workspace_${workspaceId}`);
      console.log(
        `User ${userId} left workspace room workspace_${workspaceId}`
      );
    });

    // Event handler cho việc join board mới
    socket.on('join_board', ({ userId, boardId }) => {
      if (!userId || !boardId) {
        console.warn('Invalid userId or boardId for join_board');
        return;
      }
      socket.join(`board_${boardId}`);
      console.log(`User ${userId} joined new board room board_${boardId}`);
    });

    // Event handler cho việc leave board
    socket.on('leave_board', ({ userId, boardId }) => {
      if (!userId || !boardId) {
        console.warn('Invalid userId or boardId for leave_board');
        return;
      }
      socket.leave(`board_${boardId}`);
      console.log(`User ${userId} left board room board_${boardId}`);
    });

    // Test ping handler để verify connection
    socket.on('test_ping', (data) => {
      console.log('🏓 Received test ping from frontend:', data);
      socket.emit('test_pong', {
        message: 'Hello from backend',
        receivedData: data,
        timestamp: new Date().toISOString(),
      });
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

// Utility functions để emit events tới các room khác nhau
function emitToUser(userId, event, data) {
  if (!io) {
    console.warn('⚠️ Socket.io not initialized, cannot emit to user');
    return;
  }
  io.to(userId).emit(event, data);
  console.log(
    `📡 Emitted ${event} to user ${userId}:`,
    JSON.stringify(data, null, 2)
  );
}

function emitToWorkspace(workspaceId, event, data) {
  if (!io) {
    console.warn('Socket.io not initialized, cannot emit to workspace');
    return;
  }
  io.to(`workspace_${workspaceId}`).emit(event, data);
  console.log(`Emitted ${event} to workspace workspace_${workspaceId}`);
}

function emitToBoard(boardId, event, data) {
  if (!io) {
    console.warn('Socket.io not initialized, cannot emit to board');
    return;
  }
  io.to(`board_${boardId}`).emit(event, data);
  console.log(`Emitted ${event} to board board_${boardId}`);
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToWorkspace,
  emitToBoard,
};
