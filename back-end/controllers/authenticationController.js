const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendMail = require('../utils/sendMail');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN, // 90d từ .env
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000 // 90 ngày
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  res.cookie('jwt', token, cookieOptions);

  // Loại bỏ password khỏi output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    message: statusCode === 201 ? 'Đăng ký thành công' : 'Đăng nhập thành công',
    token,
    data: {
      user,
    },
  });
};

exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'Vui lòng cung cấp username, email và password',
        status: 400,
      });
    }

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        message: 'Email đã tồn tại',
        status: 409,
      });
    }

    // Tạo user mới (mật khẩu sẽ được mã hóa trong pre-save middleware của User)
    const newUser = await User.create({
      username,
      email: email.toLowerCase(),
      password,
    });

    createSendToken(newUser, 201, res);
  } catch (error) {
    console.error('Lỗi khi đăng ký:', error.stack);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!email || !password) {
      return res.status(400).json({
        message: 'Vui lòng cung cấp email và password',
        status: 400,
      });
    }

    // Tìm user và lấy password
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );
    if (!user) {
      return res.status(401).json({
        message: 'Email không tồn tại',
        status: 401,
      });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Mật khẩu không đúng',
        status: 401,
      });
    }

    createSendToken(user, 200, res);
  } catch (error) {
    console.error('Lỗi khi đăng nhập:', error.stack);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        message: 'Không tìm thấy người dùng',
        status: 404,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng:', error.stack);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    res.status(200).json({
      status: 'success',
      message: 'Đăng xuất thành công',
    });
  } catch (error) {
    console.error('Lỗi khi đăng xuất:', error.stack);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};
