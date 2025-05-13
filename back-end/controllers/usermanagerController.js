const User = require("../models/userModel");
const mongoose = require("mongoose");

exports.updateUser = async (req, res) => {
  try {
    const { username, email, password, description } = req.body;
    const { userId } = req.params;
    const loggedInUserId = req.user._id; // Lấy ID từ token

    console.log("🔹 userId from params:", userId);
    console.log("🔹 loggedInUserId from token:", loggedInUserId);

    // Kiểm tra định dạng ObjectId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID format." });
    }

    // Kiểm tra quyền cập nhật: Chỉ cho phép user cập nhật thông tin của chính mình
    if (!loggedInUserId.equals(userId)) {
      return res
        .status(403)
        .json({ message: "Forbidden - You can only update your own profile." });
    }

    // Kiểm tra sự tồn tại của user trong DB
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Cập nhật dữ liệu người dùng
    const updateData = {
      username,
      email,
      password,
      description,
      updatedAt: Date.now(),
    };

    // Thực hiện cập nhật
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    return res.status(200).json({
      message: "Update successful",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error while updating user:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
