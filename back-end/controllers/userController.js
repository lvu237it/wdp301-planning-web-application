const mongoose = require("mongoose");
const User = require("../models/userModel");
const Board = require("../models/boardModel");
const Skill = require("../models/skillModel");
const AppError = require("../utils/appError");

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -passwordResetToken -passwordResetExpires")
      .populate("skills");

    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          fullname: user.fullname || "",
          username: user.username || "",
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
          skills: user.skills || [],
          about: user.about || "",
          experience: user.experience || "",
          yearOfExperience: user.yearOfExperience || 0,
          availability: user.availability || {
            status: "available",
            willingToJoin: true,
          },
          expectedWorkDuration: user.expectedWorkDuration || {
            min: 0,
            max: 0,
            unit: "hours",
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    if (req.body.password || req.body.role) {
      return next(
        new AppError("This route is not for password or role updates.", 400)
      );
    }

    const allowedFields = [
      "fullname",
      "username",
      "email",
      "avatar",
      "skills",
      "about",
      "experience",
      "yearOfExperience",
      "availability",
      "expectedWorkDuration",
    ];
    const filteredBody = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    if (filteredBody.email && filteredBody.email !== req.user.email) {
      const existing = await User.findOne({
        email: filteredBody.email,
        _id: { $ne: req.user._id },
      });
      if (existing) {
        return next(
          new AppError("That email is already in use by another account.", 400)
        );
      }
    }

    if (filteredBody.skills) {
      if (!Array.isArray(filteredBody.skills)) {
        return next(new AppError("Skills must be an array of skill IDs.", 400));
      }

      for (const skillId of filteredBody.skills) {
        if (!mongoose.Types.ObjectId.isValid(skillId)) {
          return next(new AppError(`Invalid skill ID: ${skillId}`, 400));
        }
        const skill = await Skill.findById(skillId);
        if (!skill) {
          return next(new AppError(`Skill not found: ${skillId}`, 404));
        }
      }
    }

    if (filteredBody.availability) {
      if (!["available", "busy"].includes(filteredBody.availability.status)) {
        return next(new AppError("Invalid availability status.", 400));
      }
      if (typeof filteredBody.availability.willingToJoin !== "boolean") {
        return next(new AppError("WillingToJoin must be a boolean.", 400));
      }
    }

    if (filteredBody.expectedWorkDuration) {
      if (
        !["hours", "days", "weeks", "months"].includes(
          filteredBody.expectedWorkDuration.unit
        )
      ) {
        return next(new AppError("Invalid work duration unit.", 400));
      }
      if (
        filteredBody.expectedWorkDuration.min < 0 ||
        filteredBody.expectedWorkDuration.max < 0
      ) {
        return next(
          new AppError("Work duration values cannot be negative.", 400)
        );
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      filteredBody,
      {
        new: true,
        runValidators: true,
      }
    )
      .select("-password -passwordResetToken -passwordResetExpires")
      .populate("skills");

    if (!updatedUser) {
      return next(new AppError("User not found.", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: updatedUser._id,
          fullname: updatedUser.fullname || "",
          username: updatedUser.username || "",
          email: updatedUser.email,
          role: updatedUser.role,
          avatar: updatedUser.avatar || null,
          skills: updatedUser.skills || [],
          about: updatedUser.about || "",
          experience: updatedUser.experience || "",
          yearOfExperience: updatedUser.yearOfExperience || 0,
          availability: updatedUser.availability || {
            status: "available",
            willingToJoin: true,
          },
          expectedWorkDuration: updatedUser.expectedWorkDuration || {
            min: 0,
            max: 0,
            unit: "hours",
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, passwordConfirm } = req.body;

    if (!currentPassword || !newPassword || !passwordConfirm) {
      return next(new AppError("All three fields are required.", 400));
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    const isMatch = await user.correctPassword(currentPassword, user.password);
    if (!isMatch) {
      return next(new AppError("Your current password is incorrect.", 401));
    }

    if (newPassword !== passwordConfirm) {
      return next(new AppError("New passwords do not match.", 400));
    }

    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    const token = require("jsonwebtoken").sign(
      { _id: user._id },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );
    res.status(200).json({ status: "success", token });
  } catch (err) {
    next(err);
  }
};

exports.deactivateMe = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isDeleted: true,
      deletedAt: Date.now(),
    });
    res.status(204).json({ status: "success", data: null });
  } catch (err) {
    next(err);
  }
};

exports.findUsersByEmails = async (req, res, next) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Danh sách email không hợp lệ",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Email không hợp lệ: ${invalidEmails.join(", ")}`,
      });
    }

    const currentUserEmail = req.user.email;
    const selfInvite = emails.includes(currentUserEmail);

    if (selfInvite) {
      return res.status(400).json({
        status: "error",
        message: "Bạn không thể mời chính mình tham gia sự kiện",
      });
    }

    const users = await User.find({
      email: { $in: emails },
      isDeleted: false,
    }).select("_id email username fullname");

    const foundEmails = users.map((user) => user.email);
    const notFoundEmails = emails.filter(
      (email) => !foundEmails.includes(email)
    );

    res.status(200).json({
      status: "success",
      data: {
        foundUsers: users.map((user) => ({
          userId: user._id,
          email: user.email,
          username: user.username,
          fullname: user.fullname || "",
        })),
        notFoundEmails,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    if (req.user.role !== "adminSystem") {
      return next(new AppError("Admin access required.", 403));
    }

    const users = await User.find({ isDeleted: false })
      .select("-password -passwordResetToken -passwordResetExpires")
      .populate("skills");

    res.status(200).json({
      status: "success",
      results: users.length,
      data: {
        users: users.map((u) => ({
          id: u._id,
          fullname: u.fullname || "",
          username: u.username || "",
          email: u.email,
          role: u.role,
          skills: u.skills || [],
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateUserById = async (req, res, next) => {
  try {
    if (req.user.role !== "adminSystem") {
      return next(new AppError("Admin access required.", 403));
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid user ID format.", 400));
    }

    if (
      id === req.user._id.toString() &&
      req.body.role &&
      req.body.role !== "adminSystem"
    ) {
      return next(new AppError("You cannot change your own role.", 400));
    }

    const allowedFields = ["role", "isDeleted"];
    const filteredBody = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(id, filteredBody, {
      new: true,
      runValidators: true,
    })
      .select("-password -passwordResetToken -passwordResetExpires")
      .populate("skills");

    if (!updatedUser) {
      return next(new AppError("User not found.", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: updatedUser._id,
          fullname: updatedUser.fullname || "",
          username: updatedUser.username || "",
          email: updatedUser.email,
          role: updatedUser.role,
          isDeleted: updatedUser.isDeleted,
          skills: updatedUser.skills || [],
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteUserById = async (req, res, next) => {
  try {
    if (req.user.role !== "adminSystem") {
      return next(new AppError("Admin access required.", 403));
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid user ID format.", 400));
    }

    const user = await User.findById(id);
    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    if (user.role === "adminSystem") {
      return next(new AppError("Cannot delete another admin user.", 400));
    }

    await User.findByIdAndDelete(id);
    res
      .status(200)
      .json({ status: "success", message: "User deleted successfully." });
  } catch (err) {
    next(err);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid user ID.", 400));
    }

    const user = await User.findById(id)
      .select("-password -passwordResetToken -passwordResetExpires")
      .populate("skills");

    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullname: user.fullname || "",
          username: user.username || "",
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
          skills: user.skills || [],
          about: user.about || "",
          experience: user.experience || "",
          yearOfExperience: user.yearOfExperience || 0,
          availability: user.availability || {
            status: "available",
            willingToJoin: true,
          },
          expectedWorkDuration: user.expectedWorkDuration || {
            min: 0,
            max: 0,
            unit: "hours",
          },
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
