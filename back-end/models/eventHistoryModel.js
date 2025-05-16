const mongoose = require('mongoose');
// Lưu trữ lịch sử sự kiện
const eventHistorySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    title: {
      type: String,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    address: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        index: '2dsphere',
      },
      formattedAddress: {
        type: String,
      },
      placeId: {
        type: String,
      },
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled'],
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

eventHistorySchema.index({ eventId: 1 });
eventHistorySchema.index({ startDate: 1 });
module.exports = mongoose.model('EventHistory', eventHistorySchema);
