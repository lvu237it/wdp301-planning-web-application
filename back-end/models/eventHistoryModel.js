const mongoose = require('mongoose');
// Lưu trữ lịch sử sự kiện
const eventHistorySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'create',
        'add_participant',
        'remove_participant',
        'update_status',
      ],
      required: true,
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'declined', 'rejected'],
          default: 'pending',
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

eventHistorySchema.index({ eventId: 1 });
eventHistorySchema.index({ participants: 1 });
eventHistorySchema.index({ startDate: 1 });
module.exports = mongoose.model('EventHistory', eventHistorySchema);
