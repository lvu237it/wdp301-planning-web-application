const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLogModel');
const BoardMembership = require('../models/boardMembershipModel');
const Task = require('../models/taskModel');
const List = require('../models/listModel');
const { formatDateToTimeZone } = require('../utils/dateUtils');

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

    const isAdmin = membership.role === 'admin';

    // Get all logs for this board
    const allLogs = await ActivityLog.find({
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
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('userId', 'fullname')
      .lean();

    // Manually populate targetId based on targetType
    const populatedLogs = await Promise.all(
      allLogs.map(async (log) => {
        if (log.targetId && log.targetType) {
          try {
            let populatedTarget = null;
            if (log.targetType === 'task') {
              populatedTarget = await Task.findById(log.targetId)
                .select('title assignedTo assignedBy')
                .populate('assignedTo', 'fullname username')
                .populate('assignedBy', 'fullname username')
                .lean();
            } else if (log.targetType === 'list') {
              populatedTarget = await List.findById(log.targetId)
                .select('title')
                .lean();
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
            return log;
          }
        }
        return log;
      })
    );

    // Filter logs based on user permissions
    const filteredLogs = populatedLogs.filter((log) => {
      // Always show visible logs
      if (log.isVisible) {
        return true;
      }

      // For invisible logs, check specific permissions
      if (!log.isVisible) {
        // Admins can see all logs
        if (isAdmin) {
          return true;
        }

        // For task-related sensitive logs, check if user is involved
        if (log.targetType === 'task' && log.targetId) {
          const task = log.targetId;
          if (
            task &&
            ((task.assignedTo &&
              task.assignedTo.toString() === userId.toString()) ||
              (task.assignedBy &&
                task.assignedBy.toString() === userId.toString()))
          ) {
            return true;
          }
        }

        // Hide other invisible logs
        return false;
      }

      return true;
    });

    const formattedLogs = filteredLogs.map((log) => {
      if (!log.userId) {
        console.warn(`ActivityLog ${log._id} has missing userId`);
      }

      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: log.userId?.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        createdAt: formatDateToTimeZone(log.createdAt),
      };

      // Only include isVisible for admins
      if (isAdmin) {
        formattedLog.isVisible = log.isVisible;
        formattedLog.targetType = log.targetType;
        formattedLog.targetTitle = log.targetId?.title || null;

        // Add assignee information for task logs in admin view
        if (log.targetType === 'task' && log.targetId) {
          formattedLog.taskAssignedTo = log.targetId.assignedTo
            ? {
                id: log.targetId.assignedTo._id,
                name:
                  log.targetId.assignedTo.fullname ||
                  log.targetId.assignedTo.username,
              }
            : null;
          formattedLog.taskAssignedBy = log.targetId.assignedBy
            ? {
                id: log.targetId.assignedBy._id,
                name:
                  log.targetId.assignedBy.fullname ||
                  log.targetId.assignedBy.username,
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

    // Manually populate targetId based on targetType
    const populatedLogs = await Promise.all(
      logs.map(async (log) => {
        if (log.targetId && log.targetType) {
          try {
            let populatedTarget = null;
            if (log.targetType === 'task') {
              populatedTarget = await Task.findById(log.targetId)
                .select('title assignedTo assignedBy')
                .lean();
            } else if (log.targetType === 'list') {
              populatedTarget = await List.findById(log.targetId)
                .select('title')
                .lean();
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
            return log;
          }
        }
        return log;
      })
    );

    const formattedLogs = populatedLogs.map((log) => {
      if (!log.userId) {
        console.warn(`ActivityLog ${log._id} has missing userId`);
      }

      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId?._id,
        userName: log.userId?.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        isVisible: log.isVisible,
        createdAt: formatDateToTimeZone(log.createdAt),
        // Add additional context for admin view
        targetType: log.targetType,
        targetTitle: log.targetId?.title || null,
      };

      // Add assignee information for task logs
      if (log.targetType === 'task' && log.targetId) {
        formattedLog.taskAssignedTo = log.targetId.assignedTo
          ? {
              id: log.targetId.assignedTo._id,
              name:
                log.targetId.assignedTo.fullname ||
                log.targetId.assignedTo.username,
            }
          : null;
        formattedLog.taskAssignedBy = log.targetId.assignedBy
          ? {
              id: log.targetId.assignedBy._id,
              name:
                log.targetId.assignedBy.fullname ||
                log.targetId.assignedBy.username,
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
