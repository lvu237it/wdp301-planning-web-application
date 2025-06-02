const mongoose = require('mongoose');
// Quản lý thành viên trong nhóm (workspace)
const membershipSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'WorkspaceId là bắt buộc'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['creatorWorkspace','adminWorkspace', 'memberWorkspace'],
      default: 'memberWorkspace',
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

membershipSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
