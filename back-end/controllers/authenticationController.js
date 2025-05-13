// exports.functionToSolveSomething
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendMail = require('../utils/sendMail');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../middlewares/jwt');
exports.registerUser = async (req, res) => {
  try {
    // Lấy dữ liệu từ request body
    const { username, email, password } = req.body;

    // Kiểm tra xem có thiếu trường nào không
    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'Missing required fields',
        status: 400,
      });
    }

    // Kiểm tra xem email đã tồn tại trong DB chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: 'Email already exists',
        status: 409,
      });
    }

    // Băm (hash) mật khẩu trước khi lưu vào database
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo user mới
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    // Trả về kết quả
    res.status(201).json({
      message: 'User registered successfully',
      status: 201,
      data: newUser,
    });
  } catch (error) {
    console.error('Error while registering user:', error);
    res.status(500).json({
      error,
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra xem có nhập đủ thông tin không
    if (!email || !password) {
      return res.status(400).json({
        message: 'Missing email or password',
        status: 400,
      });
    }

    // Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email ',
        status: 401,
      });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid password',
        status: 401,
      });
    }
    // Tạo token truy cập và token refresh
    const { description, createdAt, role, refreshToken, ...userData } =
      user.toObject();
    console.log('createdAt', createdAt);
    const accessToken = generateAccessToken(user._id, role);
    const newRefreshToken = generateRefreshToken(user._id);

    // Cập nhật token refresh trong database
    await User.findByIdAndUpdate(
      user._id,
      { refreshToken: newRefreshToken },
      { new: true }
    );

    // Thiết lập cookie chứa token refresh
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000, // 15'
    });

    // Phản hồi thông tin thành công
    res.status(200).json({
      success: true,
      accessToken,
      userData,
      role,
      createdAt,
      description,
    });
  } catch (error) {
    console.error('Error while logging in:', error);
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
      error,
    });
  }
};
exports.getCurrentUser = async (req, res) => {
  const { _id } = req.user;
  const user = await User.findById(_id).select('-refreshToken -password -role');
  res.status(200).json({
    success: !!user,
    user: user || 'User not found',
  });
};

exports.refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) throw new Error('No refresh token in cookies');

  const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  const user = await User.findOne({ _id: decoded._id, refreshToken });

  res.status(200).json({
    success: !!user,
    newAccessToken: user
      ? generateAccessToken(user._id, user.role)
      : 'Refresh token not matched',
  });
};

exports.logoutUser = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) throw new Error('No refresh token in cookies');

  await User.findOneAndUpdate(
    { refreshToken },
    { refreshToken: '' },
    { new: true }
  );
  res.clearCookie('refreshToken', { httpOnly: true, secure: true });
  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) throw new Error('Missing email');

  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');

  const resetToken = user.createPasswordChangedToken();
  await user.save();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Request</title>
  <style>
      body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
      }
      .container {
          max-width: 600px;
          margin: 20px auto;
          background: #ffffff;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          text-align: center;
      }
      .button {
          display: inline-block;
          background-color: #007bff;
          color: #ffffff;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          font-size: 16px;
          margin-top: 20px;
      }
      .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #666;
      }
  </style>
</head>
<body>
  <div class="container">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset. Please click the button below to reset your password.</p>
      <p>This link will expire in 15 minutes.</p>
      <a href="${process.env.FRONTEND_URL}/reset/${resetToken}" class="button">Reset Password</a>
      <p class="footer">If you did not request this, please ignore this email.</p>
  </div>
</body>
</html>`;

  const mailData = { email, html };
  const mailResponse = await sendMail(mailData);
  res.status(200).json({
    success: true,
    mailResponse,
  });
};

exports.resetPassword = async (req, res) => {
  const { password, token } = req.body;
  if (!password || !token) throw new Error('Missing inputs');

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) throw new Error('Invalid reset token');

  // Băm mật khẩu mới trước khi lưu
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  user.password = hashedPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = Date.now();
  await user.save();

  res.status(200).json({
    success: !!user,
    message: user ? 'Password updated' : 'Something went wrong',
  });
};
