// controllers/authenticationController.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const sendMail = require('../utils/sendMail');

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

    // 1) Basic validation
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

    // 2) Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message:
          'This email is already registered. Please use a different email or login.',
      });
    }

    // 3) Create new user; pre‐save hook will hash the password
    const newUser = await User.create({ username, email, password });

    // 4) Send welcome email (optional)
    try {
      await sendMail(
        newUser.email,
        'Welcome to the App!',
        `Hi ${newUser.username},\n\nYour account has been created successfully.`
      );
    } catch (_) {
      // Ignore mailing errors
    }

    // 5) Send JWT (legacy flow)
    createSendToken(newUser, 201, res);
  } catch (err) {
    // Handle other errors
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while creating your account.',
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

    // 1. Kiểm tra dữ liệu đầu vào
    if (!email || !password) {
      return res.status(400).json({
        message: 'Missing email or password',
        status: 400,
      });
    }

    // 2) Find user by email (select refreshToken and password explicitly if needed)
    const user = await User.findOne({ email }).select(
      '+password +refreshToken'
    );
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email',
        status: 401,
      });
    }

    // 3) Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid password',
        status: 401,
      });
    }

    // 4) Generate new tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    // 5) Update refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    // 6) Set cookie for refresh token (HTTP‐only)
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000, // 15 minutes (adjust if you want a longer lifespan)
      secure: process.env.NODE_ENV === 'production', // set secure flag in production
      sameSite: 'Strict',
    });

    // 7) Prepare userData to return (omit sensitive fields)
    const { password: pw, refreshToken: rt, ...userData } = user.toObject();

    // 8) Return success response
    res.status(200).json({
      success: true,
      accessToken,
      user: {
        ...userData,
        role: user.role,
        createdAt: user.createdAt,
        description: user.description || null,
      },
    });
  } catch (error) {
    console.error('Error while logging in:', error);
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
    const user = await User.findById(_id).select(
      '-refreshToken -password -role'
    );
    res.status(200).json({
      success: !!user,
      user: user || 'User not found',
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
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return next(new AppError('No refresh token in cookies.', 400));
    }

    // 1) Remove refresh token from DB
    await User.findOneAndUpdate(
      { refreshToken },
      { refreshToken: '' },
      { new: true }
    );

    // 2) Clear the HTTP‐only cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (err) {
    next(err);
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
