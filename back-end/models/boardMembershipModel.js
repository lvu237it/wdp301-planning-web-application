const mongoose = require('mongoose');
// Quản lý thành viên trong board
const boardMembershipSchema = new mongoose.Schema(
  {
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'BoardId là bắt buộc'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'UserId là bắt buộc'],
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'read-only'],
      default: 'member',
    },
    invitationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    invitationToken: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

boardMembershipSchema.index({ boardId: 1, userId: 1 });
module.exports = mongoose.model('BoardMembership', boardMembershipSchema);
