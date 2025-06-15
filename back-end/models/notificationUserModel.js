const mongoose = require('mongoose');

const notificationUserSchema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      required: [true, 'ID thông báo là bắt buộc'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID người dùng là bắt buộc'],
    },
    relatedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
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

notificationUserSchema.index(
  { notificationId: 1, userId: 1 },
  { unique: true }
);
notificationUserSchema.index({ userId: 1, isRead: 1 });
notificationUserSchema.index({ notificationId: 1 });

module.exports = mongoose.model('NotificationUser', notificationUserSchema);
