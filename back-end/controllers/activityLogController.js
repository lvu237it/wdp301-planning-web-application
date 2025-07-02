const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLogModel');
const BoardMembership = require('../models/boardMembershipModel');
const { formatDateToTimeZone } = require('../utils/dateUtils');

// Lấy log theo boardId (cho tất cả thành viên)
// exports.getLogsByBoard = async (req, res) => {
//   try {
//     const { boardId } = req.params;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(boardId)) {
//       return res
//         .status(400)
//         .json({ status: 'fail', message: 'boardId không hợp lệ' });
//     }

//     // Kiểm tra quyền truy cập board
//     const membership = await BoardMembership.findOne({
//       boardId,
//       userId,
//       isDeleted: false,
//       applicationStatus: 'accepted',
//     });
//     if (!membership) {
//       return res
//         .status(403)
//         .json({ status: 'fail', message: 'Không có quyền truy cập board' });
//     }

//     const filter = { boardId, isVisible: true };
//     const logs = await ActivityLog.find(filter)
//       .sort({ createdAt: -1 })
//       .limit(50)
//       .populate('userId', 'fullname')
//       .lean();

//     const formattedLogs = logs.map((log) => ({
//       logId: log._id,
//       boardId: log.boardId,
//       userId: log.userId?._id,
//       userName: log.userId?.fullname || 'Unknown User',
//       action: log.action,
//       details: log.details,
//       createdAt: formatDateToTimeZone(log.createdAt),
//     }));

//     res.status(200).json({
//       status: 'success',
//       results: formattedLogs.length,
//       data: formattedLogs,
//     });
//   } catch (error) {
//     console.error('Error in getLogsByBoard:', error);
//     res.status(500).json({ status: 'error', message: error.message });
//   }
// };
// Lấy log theo boardId (cho tất cả thành viên)
exports.getLogsByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { skip = 0, limit = 50 } = req.query; // Thêm phân trang
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res
        .status(400)
        .json({ status: 'fail', message: 'boardId không hợp lệ' });
    }

    console.log('boardId', boardId);
    console.log('userId', userId);

    // Kiểm tra quyền truy cập board
    const membership = await BoardMembership.findOne({
      boardId: boardId,
      userId: userId,
      isDeleted: false,
      applicationStatus: 'accepted',
    });
    if (!membership) {
      return res
        .status(403)
        .json({ status: 'fail', message: 'Không có quyền truy cập board' });
    }

    const filter = { boardId, isVisible: true };
    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('userId', 'fullname')
      .lean();

    const formattedLogs = logs.map((log) => {
      if (!log.userId) {
        console.warn(`ActivityLog ${log._id} has missing userId`);
      }
      return {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: log.userId?.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        createdAt: formatDateToTimeZone(log.createdAt),
      };
    });

    res.status(200).json({
      status: 'success',
      results: formattedLogs.length,
      data: formattedLogs,
    });
  } catch (error) {
    console.error('Error in getLogsByBoard:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Lấy log cho admin (bao gồm cả log isVisible: false)
// exports.getAdminLogsByBoard = async (req, res) => {
//   try {
//     const { boardId } = req.params;
//     const userId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(boardId)) {
//       return res
//         .status(400)
//         .json({ status: 'fail', message: 'boardId không hợp lệ' });
//     }

//     // Kiểm tra quyền admin
//     const membership = await BoardMembership.findOne({
//       boardId,
//       userId,
//       role: 'admin',
//       isDeleted: false,
//       applicationStatus: 'accepted',
//     });
//     if (!membership) {
//       return res
//         .status(403)
//         .json({ status: 'fail', message: 'Chỉ admin có thể xem tất cả log' });
//     }

//     const logs = await ActivityLog.find({ boardId })
//       .sort({ createdAt: -1 })
//       .limit(50)
//       .populate('userId', 'fullname')
//       .lean();

//     const formattedLogs = logs.map((log) => ({
//       logId: log._id,
//       boardId: log.boardId,
//       userId: log.userId?._id,
//       userName: log.userId?.fullname || 'Unknown User',
//       action: log.action,
//       details: log.details,
//       isVisible: log.isVisible,
//       createdAt: formatDateToTimeZone(log.createdAt),
//     }));

//     res.status(200).json({
//       status: 'success',
//       results: formattedLogs.length,
//       data: formattedLogs,
//     });
//   } catch (error) {
//     console.error('Error in getAdminLogsByBoard:', error);
//     res.status(500).json({ status: 'error', message: error.message });
//   }
// };

// Lấy log cho admin (bao gồm cả log isVisible: false)
exports.getAdminLogsByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { skip = 0, limit = 50 } = req.query; // Thêm phân trang
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res
        .status(400)
        .json({ status: 'fail', message: 'boardId không hợp lệ' });
    }

    // Kiểm tra quyền admin
    const membership = await BoardMembership.findOne({
      boardId,
      userId,
      role: 'admin',
      isDeleted: false,
    });
    if (!membership) {
      return res
        .status(403)
        .json({ status: 'fail', message: 'Chỉ admin có thể xem tất cả log' });
    }

    const logs = await ActivityLog.find({ boardId })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('userId', 'fullname')
      .lean();

    const formattedLogs = logs.map((log) => {
      if (!log.userId) {
        console.warn(`ActivityLog ${log._id} has missing userId`);
      }
      return {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: log.userId?.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        isVisible: log.isVisible,
        createdAt: formatDateToTimeZone(log.createdAt),
      };
    });

    res.status(200).json({
      status: 'success',
      results: formattedLogs.length,
      data: formattedLogs,
    });
  } catch (error) {
    console.error('Error in getAdminLogsByBoard:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
