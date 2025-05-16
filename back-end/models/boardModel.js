const mongoose = require('mongoose');
// Quản lý bảng công việc
const boardSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Tên board là bắt buộc'] },
    description: { type: String },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người tạo board là bắt buộc'],
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: false,
    },
    calendarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Calendar',
      required: true,
    },
    backgroundColor: { type: String, default: '#ffffff' },
    backgroundImage: { type: String },
    lists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'List' }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

boardSchema.index({ creator: 1 });
boardSchema.index({ calendarId: 1 });
module.exports = mongoose.model('Board', boardSchema);
