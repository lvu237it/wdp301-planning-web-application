const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

exports.protect = async (req, res, next) => {
  try {
    // Token được gửi trong header Authorization theo định dạng: "Bearer <token>"
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Giải mã và lấy thông tin liên quan tới người dùng trong token
    req.user = await User.findById(decoded._id).select(
      'role email createdAt description'
    ); // Tìm user với role cụ thể để gán vào req.user, phục vụ cho việc phân quyền
    console.log('req.user', req.user);
    next();
  } catch (error) {
    res.status(401).json({ status: 'error', message: error.message });
  }
};
