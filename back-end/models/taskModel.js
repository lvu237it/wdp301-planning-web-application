const mongoose = require('mongoose');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const { emitToBoard, emitToUser } = require('../utils/socket');
// Quản lý công việc
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề nhiệm vụ là bắt buộc'],
    },
    description: {
      type: String,
    },
    // calendarId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Calendar',
    //   required: false,
    // },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: false,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
    },
    listId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'List',
      required: true,
    },
    // eventId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Event',
    //   required: false,
    // },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: [, 'Người được giao nhiệm vụ là bắt buộc'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: [true, 'Người giao nhiệm vụ là bắt buộc'],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: Date.now,
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    recurrence: {
      type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        default: null,
      },
      interval: {
        type: Number,
        default: 1,
      },
    },
    reminderSettings: [
      {
        method: {
          type: String,
          enum: ['email', 'popup'],
          default: 'email',
        },
        daysBefore: {
          type: Number,
          default: 1,
        },
      },
    ],
    position: {
      type: Number,
      default: 0,
    },
    progress: {
      type: Number,
      default: 0,
      min: [0, 'Tiến độ không thể nhỏ hơn 0'],
      max: [100, 'Tiến độ không thể lớn hơn 100'],
    },
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
      },
    ],
    checklist: [
      {
        title: {
          type: String,
        },
        completed: {
          type: Boolean,
          default: false,
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        completedAt: {
          type: Date,
        },
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

taskSchema.pre('save', function (next) {
  if (this.checklist && this.checklist.length > 0) {
    const completedCount = this.checklist.filter(
      (item) => item.completed
    ).length;
    this.progress = (completedCount / this.checklist.length) * 100;
  }
  next();
});

// Middleware để ghi log khi tạo hoặc cập nhật task
taskSchema.pre('save', async function (next) {
  // Skip logging if userId is not available (to prevent validation errors)
  if (!this._userId) {
    return next();
  }

  const ActivityLog = mongoose.model('ActivityLog');
  const User = mongoose.model('User');
  let logs = []; // Support multiple logs for checklist items

  if (this.isNew) {
    // Get assignee name for new task
    let assigneeInfo = '';
    if (this.assignedTo) {
      try {
        const assignee = await User.findById(this.assignedTo).select(
          'fullname username'
        );
        assigneeInfo = ` - Được giao cho: ${
          assignee?.fullname || assignee?.username || 'Unknown'
        }`;
      } catch (error) {
        console.warn('Failed to get assignee info for new task:', error);
      }
    }

    logs.push({
      boardId: this.boardId,
      userId: this._userId,
      action: 'task_created',
      targetId: this._id,
      targetType: 'task',
      details: `Task "${this.title}" được tạo${assigneeInfo}`,
      isVisible: true,
    });
  } else {
    // Check for specific field changes
    const changes = [];
    let isVisible = true;
    let action = 'task_updated';
    let assigneeInfo = '';

    // Get current assignee info for logs
    if (this.assignedTo) {
      try {
        const assignee = await User.findById(this.assignedTo).select(
          'fullname username'
        );
        assigneeInfo = ` (Người được giao: ${
          assignee?.fullname || assignee?.username || 'Unknown'
        })`;
      } catch (error) {
        console.warn('Failed to get assignee info:', error);
      }
    }

    if (this.isModified('title')) changes.push('tiêu đề');
    if (this.isModified('description')) changes.push('mô tả');
    if (this.isModified('startDate')) changes.push('ngày bắt đầu');
    if (this.isModified('endDate')) changes.push('ngày kết thúc');
    if (this.isModified('progress'))
      changes.push('checklist/tiến độ công việc');

    // Handle detailed checklist changes
    if (this.isModified('checklist')) {
      // Get original checklist from the document's initial state
      const originalDoc = await this.constructor.findById(this._id);
      const oldChecklist = originalDoc ? originalDoc.checklist : [];
      const newChecklist = this.checklist || [];

      // Find completed/uncompleted items
      const completedItems = [];
      const uncompletedItems = [];

      // Create maps for easier comparison by title
      const oldItemsMap = new Map();
      oldChecklist.forEach((item, index) => {
        oldItemsMap.set(item.title, { ...item.toObject(), index });
      });

      const newItemsMap = new Map();
      newChecklist.forEach((item, index) => {
        newItemsMap.set(item.title, { ...item, index });
      });

      // Compare completion status for items that exist in both old and new
      for (const [title, newItem] of newItemsMap) {
        const oldItem = oldItemsMap.get(title);

        if (oldItem && oldItem.title === newItem.title) {
          // Item exists in both, check completion status change
          if (!oldItem.completed && newItem.completed) {
            completedItems.push(newItem.title);
          } else if (oldItem.completed && !newItem.completed) {
            uncompletedItems.push(newItem.title);
          }
        }
      }

      // Create individual logs for each checklist item change
      for (const itemTitle of completedItems) {
        logs.push({
          boardId: this.boardId,
          userId: this._userId,
          action: 'task_checklist_item_completed',
          targetId: this._id,
          targetType: 'task',
          details: `Nhiệm vụ con "${itemTitle}" đã hoàn thành trong task "${this.title}"${assigneeInfo}`,
          isVisible: true,
        });
      }

      for (const itemTitle of uncompletedItems) {
        logs.push({
          boardId: this.boardId,
          userId: this._userId,
          action: 'task_checklist_item_uncompleted',
          targetId: this._id,
          targetType: 'task',
          details: `Nhiệm vụ con "${itemTitle}" đã bỏ đánh dấu hoàn thành trong task "${this.title}"${assigneeInfo}`,
          isVisible: true,
        });
      }

      // General checklist update log if there are other changes
      // if (completedItems.length === 0 && uncompletedItems.length === 0) {
      //   changes.push('checklist');
      //   action = 'task_checklist_updated';
      // }
    }

    // Handle assignment changes (visible to assignee and assigner)
    if (this.isModified('assignedTo')) {
      let assignerInfo = '';
      let newAssigneeInfo = '';

      try {
        if (this.assignedBy) {
          const assigner = await User.findById(this.assignedBy).select(
            'fullname username'
          );
          assignerInfo = ` bởi ${
            assigner?.fullname || assigner?.username || 'Unknown'
          }`;
        }

        if (this.assignedTo) {
          const newAssignee = await User.findById(this.assignedTo).select(
            'fullname username'
          );
          newAssigneeInfo = ` cho ${
            newAssignee?.fullname || newAssignee?.username || 'Unknown'
          }`;
        }
      } catch (error) {
        console.warn('Failed to get user info for assignment:', error);
      }

      if (this.assignedTo && !this.$__.assignedTo?.original) {
        // Task assigned
        action = 'task_assigned';
        changes.push(`được giao${newAssigneeInfo}${assignerInfo}`);
        isVisible = true; // Visible to everyone - assignment is public activity
      } else if (!this.assignedTo && this.$__.assignedTo?.original) {
        // Task unassigned
        action = 'task_unassigned';
        changes.push(`hủy giao nhiệm vụ${assignerInfo}`);
        isVisible = true; // Visible to everyone - unassignment is public activity
      } else if (this.assignedTo && this.$__.assignedTo?.original) {
        // Reassigned
        action = 'task_assigned';
        changes.push(`chuyển giao${newAssigneeInfo}${assignerInfo}`);
        isVisible = true; // Visible to everyone - reassignment is public activity
      }
    }

    // Add main update log if there are changes
    if (changes.length > 0) {
      logs.push({
        boardId: this.boardId,
        userId: this._userId,
        action: action,
        targetId: this._id,
        targetType: 'task',
        details: `Task "${this.title}" ${action
          .replace('task_', '')
          .replace('_', ' ')} (${changes.join(', ')})${assigneeInfo}`,
        isVisible: isVisible,
      });
    }
  }

  // Create all logs
  for (const log of logs) {
    try {
      await ActivityLog.create(log);
      console.log(
        '✅ Task activity log created via middleware:',
        log.action,
        'for task:',
        this._id
      );
    } catch (error) {
      console.error(
        '❌ Error creating task activity log via middleware:',
        error
      );
      // Don't fail the main operation if logging fails
    }
  }
  next();
});

// Middleware để ghi log khi xóa mềm task
taskSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  const task = await this.model.findOne(this.getQuery());

  // Skip logging if userId is not available
  const userId = this.options._userId || this.getOptions()._userId;
  if (!userId) {
    return next();
  }

  if (
    update.$set &&
    update.$set.isDeleted === true &&
    task &&
    !task.isDeleted
  ) {
    const ActivityLog = mongoose.model('ActivityLog');

    // Get assignee info for deletion log
    let assigneeInfo = '';
    if (task.assignedTo) {
      try {
        const User = mongoose.model('User');
        const assignee = await User.findById(task.assignedTo).select(
          'fullname username'
        );
        assigneeInfo = ` (Người được giao: ${
          assignee?.fullname || assignee?.username || 'Unknown'
        })`;
      } catch (error) {
        console.warn('Failed to get assignee info for task deletion:', error);
      }
    }

    const log = {
      boardId: task.boardId,
      userId: userId,
      action: 'task_deleted',
      targetId: task._id,
      targetType: 'task',
      details: `Task "${task.title}" được xóa${assigneeInfo}`,
      isVisible: false, // Task deletion is sensitive - only show to relevant users
    };
    try {
      await ActivityLog.create(log);
    } catch (error) {
      console.error('Error creating activity log for task deletion:', error);
    }
  }

  next();
});

// Gửi log qua Socket.IO sau khi lưu
taskSchema.post('save', async function (doc) {
  // Chỉ emit khi có _userId (có user thực hiện action)
  if (!doc._userId) {
    return;
  }

  try {
    // Delay nhỏ để đảm bảo ActivityLog đã được tạo
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ActivityLog = mongoose.model('ActivityLog');

    // Get all recent logs for this task (within last 2 seconds to capture multiple logs)
    const recentLogs = await ActivityLog.find({
      boardId: doc.boardId,
      targetId: doc._id,
      createdAt: { $gte: new Date(Date.now() - 2000) }, // Last 2 seconds
      action: {
        $in: [
          'task_created',
          'task_updated',
          'task_assigned',
          'task_unassigned',
          'task_checklist_updated',
          'task_checklist_item_completed',
          'task_checklist_item_uncompleted',
        ],
      },
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullname')
      .lean();

    if (recentLogs.length > 0) {
      // Process each log
      for (const log of recentLogs) {
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

        console.log('📊 Emitting task activity log:', formattedLog);

        // All task logs are now public - emit to all board members
        emitToBoard(log.boardId.toString(), 'new_activity', formattedLog);
      }
    } else {
      console.warn('⚠️ No activity log found for task operation:', doc._id);
    }
  } catch (error) {
    console.error('❌ Error emitting task activity log:', error);
  }
});

// Gửi log qua Socket.IO sau khi update (bao gồm xóa mềm)
taskSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;

  try {
    // Delay nhỏ để đảm bảo ActivityLog đã được tạo
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ActivityLog = mongoose.model('ActivityLog');

    // Tìm log mới nhất cho doc này
    const log = await ActivityLog.findOne({
      boardId: doc.boardId,
      targetId: doc._id,
      action: { $in: ['task_deleted', 'task_updated'] },
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

      console.log('📊 Emitting task update activity log:', formattedLog);

      if (log.isVisible) {
        emitToBoard(log.boardId.toString(), 'new_activity', formattedLog);
      } else {
        // Sensitive logs for deletions - emit to admins and task owner
        const relevantUsers = [];

        if (doc.assignedTo) relevantUsers.push(doc.assignedTo.toString());
        if (doc.assignedBy) relevantUsers.push(doc.assignedBy.toString());

        const admins = await mongoose
          .model('BoardMembership')
          .find({ boardId: log.boardId, role: 'admin', isDeleted: false })
          .select('userId');

        admins.forEach((admin) => {
          relevantUsers.push(admin.userId.toString());
        });

        const uniqueUsers = [...new Set(relevantUsers)];
        uniqueUsers.forEach((userId) => {
          emitToUser(userId, 'task_activity', formattedLog);
        });
      }
    } else {
      console.warn(
        '⚠️ No activity log found for task update operation:',
        doc._id
      );
    }
  } catch (error) {
    console.error('❌ Error emitting task update activity log:', error);
  }
});

taskSchema.index({ workspaceId: 1, assignedTo: 1, deadline: 1 });
taskSchema.index({ boardId: 1 });
taskSchema.index({ listId: 1 });
taskSchema.index({ calendarId: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ listId: 1, position: 1 });
module.exports = mongoose.model('Task', taskSchema);
