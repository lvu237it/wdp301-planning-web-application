const mongoose = require('mongoose');
// Quản lý thông báo
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'UserId là bắt buộc'],
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
      // ],
      required: [true, 'Loại thông báo là bắt buộc'],
    },
    notificationType: {
      type: String,
      enum: ['system', 'email'],
      default: 'system',
    },
    content: {
      type: String,
      required: [true, 'Nội dung thông báo là bắt buộc'],
    },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    isRead: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, workspaceId: 1, timestamp: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ eventId: 1 });
notificationSchema.index({ taskId: 1 });
notificationSchema.index({ messageId: 1 });
module.exports = mongoose.model('Notification', notificationSchema);
