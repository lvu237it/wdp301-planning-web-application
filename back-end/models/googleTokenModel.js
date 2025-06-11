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
      type: Number, // Lưu thời gian hết hạn của accessToken (timestamp)
    },
    status: {
      type: String, // Trạng thái token: 'active', 'revoked', 'expired'
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    indexes: [
      { key: { userId: 1, service: 1 }, unique: true }, // Compound index, đảm bảo chỉ có 1 document cho mỗi user-service
      { key: { scopes: 1 } }, // Index cho scopes để tối ưu truy vấn
    ],
  }
);

module.exports = mongoose.model('GoogleToken', googleTokenSchema);
