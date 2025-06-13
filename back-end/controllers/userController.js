// controllers/userController.js
const mongoose = require('mongoose');
const User = require('../models/userModel');
const AppError = require('../utils/appError');

/**
 * @desc    Get the logged‐in user's own profile
 * @route   GET /users/profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    // req.user was set by auth.protect
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    res.status(200).json({
      status: 'success',
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
    next(err);
  }
};

/**
 * @desc    Update the logged‐in user's own profile
 * @route   PUT /users/update
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    // 1) Prevent password or role updates here
    if (req.body.password || req.body.role) {
      return next(
        new AppError('This route is not for password or role updates.', 400)
      );
    }

    // 2) Filter only allowed fields
    const allowedFields = [
      'username',
      'email',
      'avatar',
      'skills',
      'yearOfExperience',
      'availability',
      'expectedWorkDuration',
    ];
    const filteredBody = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    // 3) If email is changing, ensure it's not already in use
    if (filteredBody.email) {
      const existing = await User.findOne({
        email: filteredBody.email,
        _id: { $ne: req.user._id },
      });
      if (existing) {
        return next(
          new AppError('That email is already in use by another account.', 400)
        );
      }
    }

    // 4) Update the user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      filteredBody,
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          avatar: updatedUser.avatar || null,
          skills: updatedUser.skills || [],
          yearOfExperience: updatedUser.yearOfExperience,
          availability: updatedUser.availability,
          expectedWorkDuration: updatedUser.expectedWorkDuration,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Change password for the logged‐in user
 * @route   PUT /users/change-password
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, passwordConfirm } = req.body;

    if (!currentPassword || !newPassword || !passwordConfirm) {
      return next(new AppError('All three fields are required.', 400));
    }

    // 1) Fetch user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    // 2) Check if currentPassword is correct
    const isMatch = await user.correctPassword(currentPassword, user.password);
    if (!isMatch) {
      return next(new AppError('Your current password is incorrect.', 401));
    }

    // 3) Check new passwords match
    if (newPassword !== passwordConfirm) {
      return next(new AppError('New passwords do not match.', 400));
    }

    // 4) Update password (pre‐save hook will hash)
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    // 5) Send a new JWT
    const token = require('jsonwebtoken').sign(
      { _id: user._id },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );
    res.status(200).json({ status: 'success', token });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate (soft‐delete) the logged‐in user's own account
 * @route   DELETE /users/delete-me
 * @access  Private
 */
exports.deactivateMe = async (req, res, next) => {
  try {
    // model has `isDeleted` — mark as deleted rather than using non‐existent `isActive`
    await User.findByIdAndUpdate(req.user._id, { isDeleted: true });
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Find users by emails (for event participants)
 * @route   POST /users/find-by-emails
 * @access  Private
 */
exports.findUsersByEmails = async (req, res, next) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Danh sách email không hợp lệ',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Email không hợp lệ: ${invalidEmails.join(', ')}`,
      });
    }

    // Check if user is trying to invite themselves
    const currentUserEmail = req.user.email;
    const selfInvite = emails.includes(currentUserEmail);

    if (selfInvite) {
      return res.status(400).json({
        status: 'error',
        message: 'Bạn không thể mời chính mình tham gia sự kiện',
      });
    }

    // Find users by emails
    const users = await User.find({
      email: { $in: emails },
      isDeleted: false,
    }).select('_id email username');

    const foundEmails = users.map((user) => user.email);
    const notFoundEmails = emails.filter(
      (email) => !foundEmails.includes(email)
    );

    res.status(200).json({
      status: 'success',
      data: {
        foundUsers: users.map((user) => ({
          userId: user._id,
          email: user.email,
          username: user.username,
        })),
        notFoundEmails,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get all users (Admin only)
 * @route   GET /users
 * @access  Private (admin only)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    // Role in model is 'userSystem' / 'adminSystem'
    if (req.user.role !== 'adminSystem') {
      return next(new AppError('Admin access required.', 403));
    }

    const users = await User.find({ isDeleted: false }).select('-password');
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users: users.map((u) => ({
          id: u._id,
          username: u.username,
          email: u.email,
          role: u.role,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update a user's role or soft‐delete status (Admin only)
 * @route   PUT /users/:id
 * @access  Private (admin only)
 */
exports.updateUserById = async (req, res, next) => {
  try {
    if (req.user.role !== 'adminSystem') {
      return next(new AppError('Admin access required.', 403));
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid user ID format.', 400));
    }

    // Prevent admins from demoting themselves
    if (
      id === req.user._id.toString() &&
      req.body.role &&
      req.body.role !== 'adminSystem'
    ) {
      return next(new AppError('You cannot change your own role.', 400));
    }

    // Only allow updating `role` and `isDeleted`
    const allowedFields = ['role', 'isDeleted'];
    const filteredBody = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(id, filteredBody, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!updatedUser) {
      return next(new AppError('User not found.', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          isDeleted: updatedUser.isDeleted,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete (hard‐delete) a user by ID (Admin only)
 * @route   DELETE /users/:id
 * @access  Private (admin only)
 */
exports.deleteUserById = async (req, res, next) => {
  try {
    if (req.user.role !== 'adminSystem') {
      return next(new AppError('Admin access required.', 403));
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid user ID format.', 400));
    }

    const user = await User.findById(id);
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    if (user.role === 'adminSystem') {
      return next(new AppError('Cannot delete another admin user.', 400));
    }

    await User.findByIdAndDelete(id);
    res
      .status(200)
      .json({ status: 'success', message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user by ID (for Google OAuth callback)
 * @route   GET /users/:id
 * @access  Private
 */
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid user ID.', 400));
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          fullname: user.fullname,
          role: user.role,
          avatar: user.avatar || null,
          skills: user.skills || [],
          yearOfExperience: user.yearOfExperience,
          availability: user.availability,
          expectedWorkDuration: user.expectedWorkDuration,
          createdAt: user.createdAt,
          description: user.description || null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
