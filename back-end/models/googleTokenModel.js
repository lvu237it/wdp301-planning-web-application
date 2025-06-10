const mongoose = require('mongoose');

const googleTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  service: {
    type: String, // Thêm trường service để phân biệt (ví dụ: 'drive', 'meet')
    required: true,
    index: true,
  },
  scopes: {
    //Với mỗi 1 service tương ứng thì sẽ có thể có nhiều scopes khác nhau
    type: [String], // Lưu danh sách scope được cấp
    required: true,
    index: true, // Tạo index để tối ưu hóa truy vấn
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
  },
  expiryDate: {
    type: Number,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GoogleToken', googleTokenSchema);
