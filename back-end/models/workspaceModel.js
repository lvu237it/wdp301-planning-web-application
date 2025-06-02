const mongoose = require('mongoose');
// Quản lý nhóm người dùng
const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên nhóm là bắt buộc'],
    },
    description: {
      type: String,
    },
    creator: {
      //Người tạo workspace => khác với người là system admin hiện tại
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

workspaceSchema.index({ creator: 1 });
workspaceSchema.index({ calendarId: 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
