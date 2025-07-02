const mongoose = require('mongoose');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const { emitToBoard, emitToUser } = require('../utils/socket');

// Quản lý danh sách trong board
const listSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề danh sách là bắt buộc'],
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware để ghi log khi tạo hoặc cập nhật list
listSchema.pre('save', async function (next) {
  // Skip logging if userId is not available (to prevent validation errors)
  if (!this._userId) {
    return next();
  }

  const ActivityLog = mongoose.model('ActivityLog');
  let log = null;

  if (this.isNew) {
    log = {
      boardId: this.boardId,
      userId: this._userId, // Lấy từ middleware auth hoặc controller
      action: 'list_created',
      targetId: this._id,
      targetType: 'list',
      details: `List "${this.title}" created in board`,
      isVisible: true,
    };
  } else if (this.isModified('title') || this.isModified('position')) {
    // Combine both title and position changes into one log
    const changes = [];
    if (this.isModified('title')) changes.push('title');
    if (this.isModified('position')) changes.push('position');

    log = {
      boardId: this.boardId,
      userId: this._userId,
      action: 'list_updated',
      targetId: this._id,
      targetType: 'list',
      details: `List "${this.title}" updated (${changes.join(', ')}) in board`,
      isVisible: true,
    };
  }

  if (log) {
    try {
      await ActivityLog.create(log);
      console.log(
        '✅ Activity log created via middleware:',
        log.action,
        'for list:',
        this._id
      );
    } catch (error) {
      console.error('❌ Error creating activity log via middleware:', error);
      // Don't fail the main operation if logging fails
    }
  } else {
    console.log(
      '📝 No activity log needed for list:',
      this._id,
      'isNew:',
      this.isNew,
      'modified:',
      this.modifiedPaths()
    );
  }
  next();
});

// Middleware để ghi log khi xóa mềm list
listSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  const list = await this.model.findOne(this.getQuery());

  // Skip logging if userId is not available
  // Check both this.options._userId and this.getOptions()._userId
  const userId = this.options._userId || this.getOptions()._userId;
  if (!userId) {
    return next();
  }

  if (
    update.$set &&
    update.$set.isDeleted === true &&
    list &&
    !list.isDeleted
  ) {
    const ActivityLog = mongoose.model('ActivityLog');
    const log = {
      boardId: list.boardId,
      userId: userId,
      action: 'list_deleted',
      targetId: list._id,
      targetType: 'list',
      details: `List "${list.title}" deleted from board`,
      isVisible: false, // Chỉ admin thấy
    };
    try {
      await ActivityLog.create(log);
    } catch (error) {
      console.error('Error creating activity log for list deletion:', error);
    }
  }

  // Ghi log khi di chuyển task
  if (update.$push && update.$push.tasks) {
    const ActivityLog = mongoose.model('ActivityLog');
    const taskId = update.$push.tasks;
    const log = {
      boardId: list.boardId,
      userId: userId,
      action: 'list_task_moved',
      targetId: list._id,
      targetType: 'list',
      details: `Task ${taskId} moved to list "${list.title}" in board`,
      isVisible: true,
    };
    try {
      await ActivityLog.create(log);
    } catch (error) {
      console.error('Error creating activity log for task move:', error);
    }
  }

  next();
});

// Gửi log qua Socket.IO sau khi lưu
listSchema.post('save', async function (doc) {
  // Chỉ emit khi có _userId (có user thực hiện action)
  if (!doc._userId) {
    return;
  }

  try {
    // Delay nhỏ để đảm bảo ActivityLog đã được tạo
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ActivityLog = mongoose.model('ActivityLog');
    const log = await ActivityLog.findOne({
      boardId: doc.boardId,
      targetId: doc._id,
      action: { $in: ['list_created', 'list_updated'] },
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullname')
      .lean();

    if (log) {
      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: log.userId?.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        isVisible: log.isVisible, // Thêm field này
        createdAt: formatDateToTimeZone(log.createdAt),
      };

      console.log('📊 Emitting list activity log:', formattedLog);

      if (log.isVisible) {
        emitToBoard(log.boardId.toString(), 'new_activity', formattedLog);
      } else {
        const admins = await mongoose
          .model('BoardMembership')
          .find({ boardId: log.boardId, role: 'admin', isDeleted: false })
          .select('userId');
        admins.forEach((admin) => {
          emitToUser(admin.userId.toString(), 'admin_activity', formattedLog);
        });
      }
    } else {
      console.warn('⚠️ No activity log found for list operation:', doc._id);
    }
  } catch (error) {
    console.error('❌ Error emitting list activity log:', error);
  }
});

// Gửi log qua Socket.IO sau khi update (bao gồm xóa mềm)
listSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;

  try {
    // Delay nhỏ để đảm bảo ActivityLog đã được tạo
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ActivityLog = mongoose.model('ActivityLog');

    // Tìm log mới nhất cho doc này
    const log = await ActivityLog.findOne({
      boardId: doc.boardId,
      targetId: doc._id,
      action: { $in: ['list_deleted', 'list_updated', 'list_task_moved'] },
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullname')
      .lean();

    if (log) {
      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: log.userId?.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        isVisible: log.isVisible,
        createdAt: formatDateToTimeZone(log.createdAt),
      };

      console.log('📊 Emitting list update activity log:', formattedLog);

      if (log.isVisible) {
        emitToBoard(log.boardId.toString(), 'new_activity', formattedLog);
      } else {
        // Admin only logs (như list_deleted)
        const admins = await mongoose
          .model('BoardMembership')
          .find({ boardId: log.boardId, role: 'admin', isDeleted: false })
          .select('userId');
        admins.forEach((admin) => {
          emitToUser(admin.userId.toString(), 'admin_activity', formattedLog);
        });
      }
    } else {
      console.warn(
        '⚠️ No activity log found for list update operation:',
        doc._id
      );
    }
  } catch (error) {
    console.error('❌ Error emitting list update activity log:', error);
  }
});

listSchema.index({ boardId: 1, position: 1 });

module.exports = mongoose.model('List', listSchema);
