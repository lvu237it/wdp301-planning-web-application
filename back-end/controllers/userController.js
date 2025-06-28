const mongoose = require('mongoose');
const User = require('../models/userModel');
const Board = require('../models/boardModel');
const AppError = require('../utils/appError');

/**
 * @desc    Get the logged‐in user's own profile
 * @route   GET /users/profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
	try {
		// req.user was set by auth.protect
		const user = await User.findById(req.user._id).select(
			'-password -passwordResetToken -passwordResetExpires'
		);
		if (!user) {
			return next(new AppError('User not found.', 404));
		}

		res.status(200).json({
			status: 'success',
			data: {
				user: {
					id: user._id,
					fullname: user.fullname || '',
					username: user.username || '',
					email: user.email,
					role: user.role,
					avatar: user.avatar || null,
					skills: user.skills || [],
					about: user.about || '',
					experience: user.experience || '',
					yearOfExperience: user.yearOfExperience || 0,
					availability: user.availability || {
						status: 'available',
						willingToJoin: true,
					},
					expectedWorkDuration: user.expectedWorkDuration || {
						min: 0,
						max: 0,
						unit: 'hours',
					},
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
		// Prevent password or role updates here
		if (req.body.password || req.body.role) {
			return next(
				new AppError('This route is not for password or role updates.', 400)
			);
		}

		// Filter only allowed fields
		const allowedFields = [
			'fullname',
			'username',
			'email',
			'avatar',
			'skills',
			'about',
			'experience',
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

		// If email is changing, ensure it's not already in use
		if (filteredBody.email && filteredBody.email !== req.user.email) {
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

		// Validate complex fields
		if (filteredBody.availability) {
			if (!['available', 'busy'].includes(filteredBody.availability.status)) {
				return next(new AppError('Invalid availability status.', 400));
			}
			if (typeof filteredBody.availability.willingToJoin !== 'boolean') {
				return next(new AppError('WillingToJoin must be a boolean.', 400));
			}
		}

		if (filteredBody.expectedWorkDuration) {
			if (
				!['hours', 'days', 'weeks', 'months'].includes(
					filteredBody.expectedWorkDuration.unit
				)
			) {
				return next(new AppError('Invalid work duration unit.', 400));
			}
			if (
				filteredBody.expectedWorkDuration.min < 0 ||
				filteredBody.expectedWorkDuration.max < 0
			) {
				return next(
					new AppError('Work duration values cannot be negative.', 400)
				);
			}
		}

		// Update the user
		const updatedUser = await User.findByIdAndUpdate(
			req.user._id,
			filteredBody,
			{
				new: true,
				runValidators: true,
			}
		).select('-password -passwordResetToken -passwordResetExpires');

		if (!updatedUser) {
			return next(new AppError('User not found.', 404));
		}

		res.status(200).json({
			status: 'success',
			data: {
				user: {
					id: updatedUser._id,
					fullname: updatedUser.fullname || '',
					username: updatedUser.username || '',
					email: updatedUser.email,
					role: updatedUser.role,
					avatar: updatedUser.avatar || null,
					skills: updatedUser.skills || [],
					about: updatedUser.about || '',
					experience: updatedUser.experience || '',
					yearOfExperience: updatedUser.yearOfExperience || 0,
					availability: updatedUser.availability || {
						status: 'available',
						willingToJoin: true,
					},
					expectedWorkDuration: updatedUser.expectedWorkDuration || {
						min: 0,
						max: 0,
						unit: 'hours',
					},
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

		// Fetch user with password
		const user = await User.findById(req.user._id).select('+password');
		if (!user) {
			return next(new AppError('User not found.', 404));
		}

		// Check if currentPassword is correct
		const isMatch = await user.correctPassword(currentPassword, user.password);
		if (!isMatch) {
			return next(new AppError('Your current password is incorrect.', 401));
		}

		// Check new passwords match
		if (newPassword !== passwordConfirm) {
			return next(new AppError('New passwords do not match.', 400));
		}

		// Update password (pre‐save hook will hash)
		user.password = newPassword;
		user.passwordChangedAt = Date.now();
		await user.save();

		// Send a new JWT
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
		await User.findByIdAndUpdate(req.user._id, {
			isDeleted: true,
			deletedAt: Date.now(),
		});
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
		}).select('_id email username fullname');

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
					fullname: user.fullname || '',
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
		if (req.user.role !== 'adminSystem') {
			return next(new AppError('Admin access required.', 403));
		}

		const users = await User.find({ isDeleted: false }).select(
			'-password -passwordResetToken -passwordResetExpires'
		);
		res.status(200).json({
			status: 'success',
			results: users.length,
			data: {
				users: users.map((u) => ({
					id: u._id,
					fullname: u.fullname || '',
					username: u.username || '',
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
		}).select('-password -passwordResetToken -passwordResetExpires');

		if (!updatedUser) {
			return next(new AppError('User not found.', 404));
		}

		res.status(200).json({
			status: 'success',
			data: {
				user: {
					id: updatedUser._id,
					fullname: updatedUser.fullname || '',
					username: updatedUser.username || '',
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

		const user = await User.findById(id).select(
			'-password -passwordResetToken -passwordResetExpires'
		);
		if (!user) {
			return next(new AppError('User not found.', 404));
		}

		res.status(200).json({
			success: true,
			data: {
				user: {
					id: user._id,
					fullname: user.fullname || '',
					username: user.username || '',
					email: user.email,
					role: user.role,
					avatar: user.avatar || null,
					skills: user.skills || [],
					about: user.about || '',
					experience: user.experience || '',
					yearOfExperience: user.yearOfExperience || 0,
					availability: user.availability || {
						status: 'available',
						willingToJoin: true,
					},
					expectedWorkDuration: user.expectedWorkDuration || {
						min: 0,
						max: 0,
						unit: 'hours',
					},
					createdAt: user.createdAt,
				},
			},
		});
	} catch (err) {
		next(err);
	}
};