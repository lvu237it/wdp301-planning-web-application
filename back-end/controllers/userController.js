const User = require('../models/userModel');
const mongoose = require('mongoose');
const Recipe = require('../models/recipeModel');

exports.getAllUser = async (req, res) => {
  try {
    const user = await User.find().select(
      'username role email avatar description'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error while getting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

//Get User in4 by userID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const loggedInUserId = req.user._id; // ID từ token

    console.log('🔹 userId from params:', userId);
    console.log('🔹 loggedInUserId from token:', loggedInUserId);

    // Kiểm tra định dạng ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format.' });
    }

    // Kiểm tra quyền truy cập
    if (!loggedInUserId.equals(userId)) {
      return res
        .status(403)
        .json({ message: 'Forbidden - You can only view your own profile.' });
    }

    // Lấy thông tin user từ DB
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'success', data: user });
  } catch (error) {
    console.error('Error while getting user by ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all recipes of an user
exports.findAllRecipesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const recipes = await Recipe.find({ owner: userId, isDeleted: false }).sort(
      { createdAt: -1 } // Sắp xếp theo createdAt giảm dần (mới nhất trước)
    );

    res.status(200).json(recipes);
  } catch (error) {
    console.error('Error while getting recipes by user ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

//get detail recipes of an user
exports.findDetail = async (req, res) => {
  try {
    const { userId, recipeId } = req.params;
    const loggedInUserId = req.user._id; // Lấy ID từ token

    console.log('🔹 userId from params:', userId);
    console.log('🔹 loggedInUserId from token:', loggedInUserId);
    console.log('🔹 recipeId from params:', recipeId);

    // Kiểm tra định dạng ID hợp lệ
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(recipeId)
    ) {
      return res.status(400).json({ message: 'Invalid ID format.' });
    }

    // Kiểm tra quyền truy cập
    if (!loggedInUserId.equals(userId)) {
      return res
        .status(403)
        .json({ message: 'Forbidden - You can only view your own recipes.' });
    }

    // Tìm công thức theo ID và kiểm tra owner
    const recipe = await Recipe.findOne({ _id: recipeId, owner: userId });

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.status(200).json({
      message: 'success',
      data: recipe,
    });
  } catch (error) {
    console.error('Error while getting recipe details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

//Update in4 user

exports.updateUser = async (req, res) => {
  try {
    const { username, email, password, description } = req.body;
    const { userId } = req.params;
    const loggedInUserId = req.user._id; // Lấy ID từ token

    console.log('🔹 userId from params:', userId);
    console.log('🔹 loggedInUserId from token:', loggedInUserId);

    // Kiểm tra định dạng ObjectId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format.' });
    }

    // Kiểm tra quyền cập nhật: Chỉ cho phép user cập nhật thông tin của chính mình
    if (!loggedInUserId.equals(userId)) {
      return res
        .status(403)
        .json({ message: 'Forbidden - You can only update your own profile.' });
    }

    // Kiểm tra sự tồn tại của user trong DB
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
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
      message: 'Update successful',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error while updating user:', error);
    return res
      .status(500)
      .json({ message: 'Server error', error: error.message });
  }
};
