// controllers/authenticationController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const sendMail = require("../utils/sendMail");

// Create JWT signed with _id
const signToken = (id) => {
  return jwt.sign({ _id: id }, process.env.JWT_SECRET, {
    expiresIn: "2d",
  });
};

// Send token in HTTP‐only cookie + JSON response
const createSendToken = (user, statusCode, res) => {
  try {
    const token = signToken(user._id);

    res.cookie("jwt", token, {
      expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    });

    // Remove password from response
    user.password = undefined;

    res.status(statusCode).json({
      status: "success",
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
      status: "error",
      message: err.message,
    });
  }
};

/**
 * @desc    User signup (register a new account)
 * @route   POST /authentication/signup
 * @access  Public
 */
exports.signup = async (req, res, next) => {
  try {
    const { username, email, password, passwordConfirm } = req.body;

    // 1) Basic validation
    if (!username || !email || !password) {
      return next(
        new AppError("Username, email, and password are required.", 400)
      );
    }
    if (password !== passwordConfirm) {
      return next(new AppError("Passwords do not match.", 400));
    }

    // 2) Create new user; pre‐save hook will hash the password
    const newUser = await User.create({ username, email, password });

    // 3) Send welcome email (optional)
    try {
      await sendMail(
        newUser.email,
        "Welcome to the App!",
        `Hi ${newUser.username},\n\nYour account has been created successfully.`
      );
    } catch (_) {
      // Ignore mailing errors
    }

    // 4) Send JWT
    createSendToken(newUser, 201, res);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    User login
 * @route   POST /authentication/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email & password provided
    if (!email || !password) {
      return next(new AppError("Please provide email and password.", 400));
    }

    // 2) Check if user exists & not soft‐deleted
    const user = await User.findOne({ email, isDeleted: false }).select(
      "+password"
    );
    if (!user) {
      return next(new AppError("Incorrect email or password.", 400));
    }

    // 3) Check if password is correct
    const isCorrect = await user.correctPassword(password, user.password);
    if (!isCorrect) {
      return next(new AppError("Incorrect email or password.", 400));
    }

    // 4) Send JWT
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Log out user (clear cookie)
 * @route   GET /authentication/logout
 * @access  Private
 */
exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

/**
 * @desc    Forgot Password – send a reset token via email
 * @route   POST /authentication/forgotPassword
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new AppError("Please provide your email address.", 400));
    }

    // 1) Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(
        new AppError("There is no user with that email address.", 404)
      );
    }

    // 2) Generate random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 3) Store hashed token & expiry
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    // 4) Send email with reset link
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/authentication/resetPassword/${resetToken}`;
    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}\nIf you didn't forget your password, please ignore this email.`;

    try {
      await sendMail(
        user.email,
        "Your password reset token (valid for 10 minutes)",
        message
      );
      res
        .status(200)
        .json({ status: "success", message: "Token sent to email!" });
    } catch (_) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError("Error sending email. Try again later.", 500));
    }
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Reset Password – set a new password using the token
 * @route   PATCH /authentication/resetPassword/:token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // 1) Find user by token and check expiry
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password");
    if (!user) {
      return next(new AppError("Token is invalid or has expired.", 400));
    }

    // 2) Validate new passwords
    const { password, passwordConfirm } = req.body;
    if (!password || password !== passwordConfirm) {
      return next(new AppError("Passwords do not match.", 400));
    }

    // 3) Update password
    user.password = password;
    user.passwordChangedAt = Date.now();
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 4) Send new JWT
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update the logged‐in user’s password
 * @route   PATCH /authentication/updateMyPassword
 * @access  Private
 */
exports.updateMyPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, passwordConfirm } = req.body;

    if (!currentPassword || !newPassword || !passwordConfirm) {
      return next(new AppError("All fields are required.", 400));
    }

    // 1) Get user with password
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    // 2) Check current password
    const isMatch = await user.correctPassword(currentPassword, user.password);
    if (!isMatch) {
      return next(new AppError("Your current password is incorrect.", 401));
    }

    // 3) Validate new passwords
    if (newPassword !== passwordConfirm) {
      return next(new AppError("New passwords do not match.", 400));
    }

    // 4) Update password
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    // 5) Send new JWT
    const token = signToken(user._id);
    res.status(200).json({ status: "success", token });
  } catch (err) {
    next(err);
  }
};
