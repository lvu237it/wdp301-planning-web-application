const mongoose = require('mongoose');

const googleTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    service: {
      type: String, // Ví dụ: 'drive', 'meet', 'calendar'
      required: true,
      enum: ['drive', 'meet', 'calendar'], // Giới hạn các giá trị hợp lệ
    },
    scopes: {
      type: [String], // Danh sách scopes cho dịch vụ cụ thể
      required: true,
      validate: {
        validator: (scopes) => scopes.length > 0, // Đảm bảo mảng không rỗng
        message: 'At least one scope is required',
      },
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    refreshTokenExpiryDate: {
      type: Date,
      required: true,
    },
    lastRefreshed: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String, // Trạng thái token: 'active', 'revoked', 'expired'
      enum: ['active', 'revoked', 'expired'], //đang hoạt động - đã thu hồi (bị vô hiệu hoá thủ công/ko đc chấp nhận nữa) - hết hạn
      default: 'active',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    indexes: [
      { key: { userId: 1, service: 1 }, unique: true }, // Compound index, đảm bảo chỉ có 1 document cho mỗi user-service
      { key: { scopes: 1 } }, // Index cho scopes để tối ưu truy vấn
      { key: { status: 1 } },
      { key: { expiryDate: 1 } },
      { key: { refreshTokenExpiryDate: 1 } },
    ],
  }
);

// Add method to check if token needs refresh
googleTokenSchema.methods.needsRefresh = function () {
  const now = Date.now();
  const REFRESH_BEFORE = 5 * 60 * 1000; // 5 minutes before expiry
  return this.expiryDate - now < REFRESH_BEFORE;
};

// Add method to check if refresh token is expired
googleTokenSchema.methods.isRefreshTokenExpired = function () {
  return (
    this.refreshTokenExpiryDate && this.refreshTokenExpiryDate < Date.now()
  );
};

module.exports = mongoose.model('GoogleToken', googleTokenSchema);
