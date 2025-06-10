const mongoose = require('mongoose');
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
    calendarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Calendar',
      required: false,
    },
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
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: false,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người được giao nhiệm vụ là bắt buộc'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người giao nhiệm vụ là bắt buộc'],
    },
    deadline: {
      type: Date,
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
      endDate: {
        type: Date,
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
    labels: [
      {
        type: String,
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

taskSchema.index({ workspaceId: 1, assignedTo: 1, deadline: 1 });
taskSchema.index({ boardId: 1 });
taskSchema.index({ listId: 1 });
taskSchema.index({ calendarId: 1 });
taskSchema.index({ assignedBy: 1 });
module.exports = mongoose.model('Task', taskSchema);
