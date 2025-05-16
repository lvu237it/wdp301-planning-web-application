const mongoose = require('mongoose');
// Quản lý danh sách trong board
const listSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề danh sách là bắt buộc'],
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
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

listSchema.index({ boardId: 1, position: 1 });
module.exports = mongoose.model('List', listSchema);
