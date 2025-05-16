const mongoose = require('mongoose');
// Ghi lại lịch sử hoạt động trong board
const activityLogSchema = new mongoose.Schema(
  {
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetType: { type: String, enum: ['task', 'message', 'list'] },
    details: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ boardId: 1, timestamp: -1 });
module.exports = mongoose.model('ActivityLog', activityLogSchema);
