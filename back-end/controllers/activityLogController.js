const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLogModel');
const BoardMembership = require('../models/boardMembershipModel');
const Task = require('../models/taskModel');
const List = require('../models/listModel');
const User = require('../models/userModel');
const { formatDateToTimeZone } = require('../utils/dateUtils');

// Helper function to get user display name
const getUserDisplayName = (user) => {
  if (!user) return 'Unknown User';
  return user.fullname || user.username || user.email || 'Unknown User';
};

// Helper function to safely populate target based on type
const populateTarget = async (log) => {
  if (!log.targetId || !log.targetType) {
    return { ...log, targetId: null };
  }

  try {
    let populatedTarget = null;

    switch (log.targetType) {
      case 'task':
        populatedTarget = await Task.findById(log.targetId)
          .select('title assignedTo assignedBy')
          .populate('assignedTo', 'fullname username email')
          .populate('assignedBy', 'fullname username email')
          .lean();
        break;
      case 'list':
        populatedTarget = await List.findById(log.targetId)
          .select('title')
          .lean();
        break;
      default:
        break;
    }

    return {
      ...log,
      targetId: populatedTarget,
    };
  } catch (error) {
    console.warn(
      `Failed to populate ${log.targetType} with ID ${log.targetId}:`,
      error.message
    );
    return { ...log, targetId: null };
  }
};

// Lấy log theo boardId (cho tất cả thành viên)
exports.getLogsByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { skip = 0, limit = 50 } = req.query;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res
        .status(400)
        .json({ status: 'fail', message: 'boardId không hợp lệ' });
    }

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

    const isAdmin = membership.role === 'admin';

    // Get all logs for this board with better filtering
    const query = {
      boardId,
      $or: [
        { isVisible: true },
        {
          isVisible: false,
          action: {
            $in: ['task_assigned', 'task_unassigned', 'task_document_removed'],
          },
        },
      ],
    };

    const allLogs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('userId', 'fullname username email')
      .lean();

    // Populate targets in parallel
    const populatedLogs = await Promise.all(allLogs.map(populateTarget));

    // Filter logs based on user permissions
    const filteredLogs = populatedLogs.filter((log) => {
      // Always show visible logs
      if (log.isVisible) return true;

      // For invisible logs, check specific permissions
      if (!log.isVisible) {
        // Admins can see all logs
        if (isAdmin) return true;

        // For task-related sensitive logs, check if user is involved
        if (log.targetType === 'task' && log.targetId) {
          const task = log.targetId;
          if (task) {
            const taskAssignedToId =
              task.assignedTo?._id?.toString() ||
              task.assignedTo?.id?.toString();
            const taskAssignedById =
              task.assignedBy?._id?.toString() ||
              task.assignedBy?.id?.toString();
            const currentUserIdStr = userId.toString();

            if (
              taskAssignedToId === currentUserIdStr ||
              taskAssignedById === currentUserIdStr
            ) {
              return true;
            }
          }
        }
        return false;
      }

      return true;
    });

    // Format logs with consistent naming
    const formattedLogs = filteredLogs.map((log) => {
      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: getUserDisplayName(log.userId),
        name: getUserDisplayName(log.userId), // Add name property as requested
        action: log.action,
        details: log.details,
        createdAt: formatDateToTimeZone(log.createdAt),
      };

      // Add admin-specific fields
      if (isAdmin) {
        formattedLog.isVisible = log.isVisible;
        formattedLog.targetType = log.targetType;
        formattedLog.targetTitle = log.targetId?.title || null;

        // Add assignee information for task logs in admin view
        if (log.targetType === 'task' && log.targetId) {
          formattedLog.taskAssignedTo = log.targetId.assignedTo
            ? {
                id: log.targetId.assignedTo._id,
                name: getUserDisplayName(log.targetId.assignedTo),
              }
            : null;
          formattedLog.taskAssignedBy = log.targetId.assignedBy
            ? {
                id: log.targetId.assignedBy._id,
                name: getUserDisplayName(log.targetId.assignedBy),
              }
            : null;
        }
      }

      return formattedLog;
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
exports.getAdminLogsByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { skip = 0, limit = 50 } = req.query;
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
      .populate('userId', 'fullname username email')
      .lean();

    // Populate targets in parallel
    const populatedLogs = await Promise.all(logs.map(populateTarget));

    // Format logs for admin view
    const formattedLogs = populatedLogs.map((log) => {
      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: getUserDisplayName(log.userId),
        name: getUserDisplayName(log.userId), // Add name property as requested
        action: log.action,
        details: log.details,
        isVisible: log.isVisible,
        createdAt: formatDateToTimeZone(log.createdAt),
        targetType: log.targetType,
        targetTitle: log.targetId?.title || null,
      };

      // Add assignee information for task logs
      if (log.targetType === 'task' && log.targetId) {
        formattedLog.taskAssignedTo = log.targetId.assignedTo
          ? {
              id: log.targetId.assignedTo._id,
              name: getUserDisplayName(log.targetId.assignedTo),
            }
          : null;
        formattedLog.taskAssignedBy = log.targetId.assignedBy
          ? {
              id: log.targetId.assignedBy._id,
              name: getUserDisplayName(log.targetId.assignedBy),
            }
          : null;
      }

      return formattedLog;
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
