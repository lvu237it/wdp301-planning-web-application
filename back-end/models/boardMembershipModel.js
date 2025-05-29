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
      default: 'read-only',
      description: 'Vai trò của người dùng trong board.',
    },
    // flow: 1 Người - ứng viên vào board
    // trường hợp 1 (applicationStatus = applied): tự apply vào => mặc định vai trò là read-only => thông qua 2 bước xét (AI sàng lọc tiêu chí + admin duyệt) => trở thành member (accepted) hoặc bị loại (rejected) (trường hợp này invitationResponse null)

    // trường hợp 2: được ai đó mời vào => mặc định vai trò là read-only, nếu chấp nhận thì coi như set applicationStatus là applied và thành role: read-only,
    // sau đó nối tiếp trường hợp 1 => thông qua 2 bước xét (AI sàng lọc tiêu chí + admin duyệt) => trở thành member (accepted) hoặc bị loại (rejected) (trường hợp này invitationResponse null)
    applicationStatus: {
      type: String,
      enum: ['applied', 'accepted', 'rejected'],
      default: 'applied',
      description:
        'Trạng thái xét duyệt: applied (tự ứng tuyển), accepted (quản trị viên chấp nhận), rejected (quản trị viên từ chối).',
    },
    invitationResponse: {
      type: String,
      enum: ['pending', 'accepted', 'declined', null],
      default: null,
      description:
        'Phản hồi lời mời: pending (chưa phản hồi), accepted (đồng ý), declined (từ chối), null (không có lời mời).',
    },
    invitedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: false,
      description:
        'Người mời người dùng vào board (chỉ dùng trong trường hợp mời).',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
      description: 'Thời điểm người dùng ứng tuyển hoặc chấp nhận lời mời.',
    },
    invitedAt: {
      type: Date,
      description: 'Thời điểm người dùng được mời vào board.',
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Middleware để tự động cập nhật role và trạng thái
boardMembershipSchema.pre('save', function (next) {
  // Nếu invitationResponse là 'accepted', chuyển sang applicationStatus: applied
  if (
    this.isModified('invitationResponse') &&
    this.invitationResponse === 'accepted'
  ) {
    this.applicationStatus = 'applied';
    this.invitationResponse = null;
    this.appliedAt = new Date();
  }
  // Nếu invitationResponse là 'declined', đánh dấu xóa
  if (
    this.isModified('invitationResponse') &&
    this.invitationResponse === 'declined'
  ) {
    this.isDeleted = true;
    this.deletedAt = new Date();
  }
  // Nếu applicationStatus là 'accepted', chuyển role sang member
  if (
    this.isModified('applicationStatus') &&
    this.applicationStatus === 'accepted'
  ) {
    if (this.role === 'read-only') {
      this.role = 'member';
    }
  }
  // Đảm bảo invitationResponse chỉ có giá trị khi có invitedBy
  if (this.invitationResponse && !this.invitedBy) {
    return next(new Error('invitationResponse chỉ áp dụng khi có invitedBy'));
  }
  next();
});

boardMembershipSchema.index({ boardId: 1, userId: 1 }, { unique: true });
boardMembershipSchema.index({ boardId: 1, applicationStatus: 1 });
boardMembershipSchema.index({ boardId: 1, invitationResponse: 1 });
boardMembershipSchema.index({ matchScore: -1 });

module.exports = mongoose.model('BoardMembership', boardMembershipSchema);
