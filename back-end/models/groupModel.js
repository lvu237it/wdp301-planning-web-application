const mongoose = require('mongoose');
// Quản lý nhóm người dùng
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên nhóm là bắt buộc'],
    },
    description: {
      type: String,
    },
    creator: {
      //Người tạo nhóm => khác với người là admin hiện tại
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người tạo nhóm là bắt buộc'],
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Membership',
      },
    ],
    calendarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Calendar',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

groupSchema.index({ creator: 1 });
groupSchema.index({ calendarId: 1 });

module.exports = mongoose.model('Group', groupSchema);
