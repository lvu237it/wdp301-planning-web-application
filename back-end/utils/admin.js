const mongoose = require('mongoose');
const User = require('../models/userModel');

let adminId = null;

exports.initializeAdminId = async () => {
  try {
    const admin = await User.findOne({
      role: 'adminSystem',
      isDeleted: false,
    }).select('_id');

    if (!admin) {
      throw new Error('Không tìm thấy admin');
    }

    adminId = admin._id;
    console.log('Admin ID:', adminId);
  } catch (error) {
    throw new Error(`Lỗi khi khởi tạo admin ID: ${error.message}`);
  }
};

exports.getAdminId = () => {
  if (!adminId) {
    throw new Error('Admin ID chưa được khởi tạo');
  }
  return adminId;
};
