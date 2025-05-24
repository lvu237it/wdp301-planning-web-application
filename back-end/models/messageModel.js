const mongoose = require('mongoose');
// Quản lý bình luận trong sự kiện/task

const messageSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'UserId là bắt buộc'],
    },
    content: {
      type: String,
      required: [true, 'Nội dung tin nhắn là bắt buộc'],
    },
    parentMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    isPinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ eventId: 1, timestamp: -1 });
messageSchema.index({ taskId: 1, timestamp: -1 });
messageSchema.index({ userId: 1 });
messageSchema.index({ parentMessage: 1 });
module.exports = mongoose.model('Message', messageSchema);
