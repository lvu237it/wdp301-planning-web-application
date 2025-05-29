const mongoose = require('mongoose');
// Lưu trữ lịch sử sự kiện
const eventHistorySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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

eventHistorySchema.index({ eventId: 1 });
eventHistorySchema.index({ startDate: 1 });
module.exports = mongoose.model('EventHistory', eventHistorySchema);
