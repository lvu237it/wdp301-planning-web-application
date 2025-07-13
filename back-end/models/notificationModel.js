const mongoose = require('mongoose');
// Quản lý thông báo
const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề thông báo là bắt buộc'],
    },
    content: {
      type: String,
      required: [true, 'Nội dung thông báo là bắt buộc'],
    },
    type: {
      type: String,
      //  enum: [
      //   'event_invite',
      //   'event_update',
      //   'workspace_invite',
      //   'message',
      //   'file_shared',
      //   'task_assigned',
      //   'task_updated',
      //   'event_reminder',
      //   'task_reminder',
      //   'user_applied',
      //   'user_recommended',
      //   'user_accepted',
      //   'user_rejected',
      //   'new_message',
      // ],
      required: [true, 'Loại thông báo là bắt buộc'],
    },
    audienceType: {
      type: String,
      enum: ['personal', 'workspace', 'global'],
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    targetWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ targetUserId: 1 });
notificationSchema.index({ targetWorkspaceId: 1 });
notificationSchema.index({ audienceType: 1 });
notificationSchema.index({ eventId: 1 });
notificationSchema.index({ taskId: 1 });
notificationSchema.index({ messageId: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
