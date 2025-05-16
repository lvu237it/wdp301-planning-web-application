const mongoose = require('mongoose');
// Quản lý thành viên trong nhóm (group)
const membershipSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'GroupId là bắt buộc'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['adminGroup', 'memberGroup'],
      default: 'memberGroup',
    },
    invitationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    invitationToken: { type: String },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  { timestamps: true }
);

membershipSchema.index({ userId: 1, groupId: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
