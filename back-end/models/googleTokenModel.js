const mongoose = require('mongoose');

const googleTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, //đảm bảo mỗi người dùng chỉ có một bộ token
  },
  //Lưu thông tin token từ Google để sử dụng lại
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
