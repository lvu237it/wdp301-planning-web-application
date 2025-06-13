// controllers/authenticationController.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const passport = require('passport');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const sendMail = require('../utils/sendMail');
const { getAdminId } = require('../utils/admin');
const NotificationService = require('../services/NotificationService');

/**
 * Generate a JWT access token.
 * Payload includes user ID and role.
 * Expires in the shorter lifespan (e.g., process.env.JWT_EXPIRES_IN, default "2d").
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign({ _id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2d',
  });
};

/**
 * Generate a JWT refresh token.
 * Payload includes only user ID. Expires in a longer lifespan
 * (e.g., process.env.JWT_REFRESH_EXPIRES_IN, default "7d").
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ _id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

// Create JWT signed with _id (used by createSendToken for legacy flows)
const signToken = (id) => {
  return jwt.sign({ _id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2d',
  });
};

// -----------------------------------------------------------------------------
// Helper to send token in an HTTP‐only cookie + JSON response (legacy signup flow)
// -----------------------------------------------------------------------------
const createSendToken = (user, statusCode, res) => {
  try {
    const token = signToken(user._id);

    res.cookie('jwt', token, {
      expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    });

    // Remove password from response object
    user.password = undefined;

    res.status(statusCode).json({
      status: 'success',
      token,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
          skills: user.skills || [],
          yearOfExperience: user.yearOfExperience,
          availability: user.availability,
          expectedWorkDuration: user.expectedWorkDuration,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err,
    });
  }
};

// -----------------------------------------------------------------------------
// @desc    User signup (register a new account)
// @route   POST /authentication/signup
// @access  Public
// -----------------------------------------------------------------------------

exports.signup = async (req, res, next) => {
  try {
    const { username, email, password, passwordConfirm } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, email, and password are required.',
      });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'This email is already registered.',
      });
    }

    const newUser = await User.create({ username, email, password });

    try {
      await sendMail(
        newUser.email,
        'Welcome to the App!',
        `Hi ${newUser.username},\n\nYour account has been created successfully.`
      );
    } catch (_) {}

    createSendToken(newUser, 201, res);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating account.',
    });
  }
};

// -----------------------------------------------------------------------------
// @desc    User login
// @route   POST /authentication/login
// @access  Public
// -----------------------------------------------------------------------------

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Missing email or password',
        status: 400,
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email',
        status: 401,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid password',
        status: 401,
      });
    }

    const token = signToken(user._id);
    res.cookie('jwt', token, {
      httpOnly: true,
      maxAge: 2 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    const { password: pw, ...userData } = user.toObject();
    res.status(200).json({
      success: true,
      accessToken: token,
      user: {
        ...userData,
        role: user.role,
        createdAt: user.createdAt,
        description: user.description || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
      error: error.message,
    });
  }
};

// -----------------------------------------------------------------------------
// @desc    Get the currently logged‐in user's data
// @route   GET /authentication/me
// @access  Private
// -----------------------------------------------------------------------------

exports.getCurrentUser = async (req, res, next) => {
  try {
    const { _id } = req.user;
    console.log('req.user:', req.user); // Debugging line to check user data
    const user = await User.findById(_id).select(
      '-refreshToken -password -role'
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Tạo token mới để trả về
    const token = signToken(_id);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        fullname: user.fullname,
        username: user.username,
        avatar: user.avatar,
        role: user.role, // Giữ role để khớp với login
        createdAt: user.createdAt,
        description: user?.description || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------------------------------
// @desc    Refresh access token using a valid refresh token from cookie
// @route   GET /authentication/refresh-token
// @access  Public (but requires a valid HTTP‐only cookie)
// -----------------------------------------------------------------------------
exports.refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return next(new AppError('No refresh token in cookies.', 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      return next(new AppError('Invalid or expired refresh token.', 401));
    }

    // 1) Find user with matching refreshToken
    const user = await User.findOne({ _id: decoded._id, refreshToken });
    if (!user) {
      return next(new AppError('Refresh token does not match any user.', 401));
    }

    // 2) Generate a brand‐new access token
    const newAccessToken = generateAccessToken(user._id, user.role);
    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------------------------------
// @desc    Logout user: clear refresh token from DB + cookie
// @route   POST /authentication/logout
// @access  Private
// -----------------------------------------------------------------------------

exports.logoutUser = async (req, res, next) => {
  try {
    // Hủy session Passport
    req.logout((err) => {
      if (err) {
        return next(new AppError('Error logging out', 500));
      }
      // Hủy session Express
      req.session.destroy((err) => {
        if (err) {
          return next(new AppError('Error destroying session', 500));
        }
        // Xóa cookie
        res.clearCookie('jwt', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict',
        });
        res.status(200).json({
          success: true,
          message: 'Logout successful',
        });
      });
    });
  } catch (err) {
    next(new AppError('Logout error', 500));
  }
};

// -----------------------------------------------------------------------------
// @desc    Forgot Password: send a reset token to user's email
// @route   POST /authentication/forgotPassword
// @access  Public
// -----------------------------------------------------------------------------
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError('Missing email', 400));

    // 1) Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(
        new AppError('There is no user with that email address.', 404)
      );
    }

    // 2) Generate random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // 3) Store hashed token & expiry
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    // 4) Send email with reset link
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/authentication/resetPassword/${resetToken}`;
    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}\nIf you didn't forget your password, please ignore this email.`;
    try {
      await sendMail(
        user.email,
        'Your password reset token (valid for 10 minutes)',
        message
      );
      res
        .status(200)
        .json({ status: 'success', message: 'Token sent to email!' });
    } catch (emailErr) {
      // Revert on failure
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError('Error sending email. Try again later.', 500));
    }
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------------------------------
// @desc    Reset Password – set a new password using the token
// @route   PATCH /authentication/resetPassword/:token
// @access  Public
// -----------------------------------------------------------------------------
exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // 1) Find user by token and check expiry
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');
    if (!user) {
      return next(new AppError('Token is invalid or has expired.', 400));
    }

    // 2) Validate new passwords
    const { password, passwordConfirm } = req.body;
    if (!password || password !== passwordConfirm) {
      return next(new AppError('Passwords do not match.', 400));
    }

    // 3) Update password
    user.password = password;
    user.passwordChangedAt = Date.now();
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 4) Send new JWT (legacy flow)
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------------------------------
// @desc    Update the logged‐in user's password
// @route   PATCH /authentication/updateMyPassword
// @access  Private
// -----------------------------------------------------------------------------
exports.updateMyPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, passwordConfirm } = req.body;

    if (!currentPassword || !newPassword || !passwordConfirm) {
      return next(new AppError('All fields are required.', 400));
    }

    // 1) Get user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    // 2) Check current password
    const isMatch = await user.correctPassword(currentPassword, user.password);
    if (!isMatch) {
      return next(new AppError('Your current password is incorrect.', 401));
    }

    // 3) Validate new passwords
    if (newPassword !== passwordConfirm) {
      return next(new AppError('New passwords do not match.', 400));
    }

    // 4) Update password
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    // 5) Send new JWT (legacy flow)
    const token = signToken(user._id);
    res.status(200).json({ status: 'success', token });
  } catch (err) {
    next(err);
  }
};

// Hàm gửi token cho đăng nhập Google
const sendGoogleAuthToken = async (user, res) => {
  try {
    const token = signToken(user._id);

    // Gửi token trong cookie với cấu hình phù hợp cho cross-origin
    const cookieOptions = {
      httpOnly: true,
      maxAge: 2 * 24 * 60 * 60 * 1000, // 2 ngày
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-origin for OAuth
    };

    // Only set domain in production if COOKIE_DOMAIN is specified
    // COOKIE_DOMAIN should be set in .env file for production (e.g., COOKIE_DOMAIN=.yourdomain.com)
    if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    console.log('Setting cookie with options:', cookieOptions);
    res.cookie('jwt', token, cookieOptions);

    console.log('Redirecting to frontend with success=true and token');
    // Redirect về frontend với token trong URL để backup
    res.redirect(
      `${
        process.env.FRONTEND_URL
      }/google-callback?success=true&token=${encodeURIComponent(token)}`
    );
  } catch (err) {
    console.error('Google auth token error:', err);
    res.redirect(
      `${
        process.env.FRONTEND_URL
      }/login?error=google_auth_failed&message=${encodeURIComponent(
        err.message || 'Lỗi khi xử lý đăng nhập Google'
      )}`
    );
  }
};

// Khởi tạo quy trình đăng nhập Google bằng passport.authenticate.
// Đơn giản hóa và chỉ sử dụng prompt select_account thay vì consent để tránh yêu cầu scopes mỗi lần
exports.googleAuth = passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/meetings.space.created',
    'https://www.googleapis.com/auth/calendar',
  ],
  prompt: 'select_account', // Chỉ yêu cầu chọn tài khoản, không ép consent mỗi lần
});

// Xử lý callback từ Google, sử dụng sendGoogleAuthToken để tạo token JWT, lưu refreshToken
// vào cookie và database, gửi thông báo, và trả về phản hồi tương tự như login.
exports.googleAuthCallback = async (req, res, next) => {
  passport.authenticate(
    'google',
    {
      failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`,
    },
    async (err, user) => {
      if (err || !user) {
        console.error('Google auth failed:', err);
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=google_auth_failed`
        );
      }
      console.log('Google auth user:', user.email);
      await sendGoogleAuthToken(user, res);
    }
  )(req, res, next);
};

exports.googleAuthCallbackUserData = async (req, res) => {
  // Debug logs
  console.log('=== DEBUG USERDATA ENDPOINT ===');
  console.log('Headers:', req.headers);
  console.log('Cookies:', req.cookies);
  console.log('All cookies from header:', req.headers.cookie);

  // This endpoint will extract user data from JWT cookie
  let token;

  // Try to get token from cookie
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
    console.log('Found JWT in cookies:', token.substring(0, 20) + '...');
  } else {
    console.log('No JWT cookie found');
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No authentication token found',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully:', decoded);

    // Get user data
    User.findById(decoded._id)
      .then((user) => {
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found',
          });
        }

        console.log('User found:', user.email);
        res.status(200).json({
          success: true,
          token: token,
          user: {
            _id: user._id,
            email: user.email,
            fullname: user.fullname,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
            createdAt: user.createdAt,
            description: user.description || null,
          },
        });
      })
      .catch((error) => {
        console.error('Error fetching user:', error);
        res.status(500).json({
          success: false,
          message: 'Error fetching user data',
        });
      });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

//Link Google account to existing user
exports.linkGoogleAccount = async (req, res, next) => {
  passport.authenticate(
    'google',
    {
      failureRedirect: `${process.env.FRONTEND_URL}/profile?error=google_link_failed`,
    },
    async (err, user) => {
      if (err || !user) {
        console.error('Google link failed:', err);
        return res.redirect(
          `${
            process.env.FRONTEND_URL
          }/profile?error=google_link_failed&message=${encodeURIComponent(
            err ? err.message : 'Failed to link Google account'
          )}`
        );
      }

      try {
        // Cập nhật googleId cho user hiện tại
        const currentUser = await User.findById(req.user._id);
        if (!currentUser) {
          return res.redirect(
            `${process.env.FRONTEND_URL}/profile?error=google_link_failed&message=User not found`
          );
        }

        if (currentUser.googleId) {
          return res.redirect(
            `${process.env.FRONTEND_URL}/profile?error=google_link_failed&message=Google account already linked`
          );
        }

        currentUser.googleId = user.googleId;
        await currentUser.save();

        // Lưu Google tokens
        const services = [
          {
            service: 'calendar',
            scopes: ['https://www.googleapis.com/auth/calendar'],
          },
          {
            service: 'drive',
            scopes: [
              'https://www.googleapis.com/auth/drive.file',
              'https://www.googleapis.com/auth/drive.metadata.readonly',
            ],
          },
          {
            service: 'meet',
            scopes: ['https://www.googleapis.com/auth/meetings.space.created'],
          },
        ];

        for (const { service, scopes } of services) {
          await GoogleToken.findOneAndUpdate(
            { userId: currentUser._id, service },
            {
              userId: currentUser._id,
              service,
              scopes,
              accessToken: user.accessToken || null,
              refreshToken: user.refreshToken || null,
              expiryDate: user.expiry_date || Date.now() + 3600 * 1000,
              status: 'active',
            },
            { upsert: true, new: true }
          );
        }

        // Redirect về profile với thông báo thành công
        res.redirect(
          `${process.env.FRONTEND_URL}/profile?success=google_link_success`
        );
      } catch (err) {
        console.error('Error linking Google account:', err);
        res.redirect(
          `${
            process.env.FRONTEND_URL
          }/profile?error=google_link_failed&message=${encodeURIComponent(
            err.message
          )}`
        );
      }
    }
  )(req, res, next);
};
