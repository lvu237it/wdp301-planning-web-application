const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const User = require('../models/userModel');
const NotificationUser = require('../models/notificationUserModel');

exports.getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id; // Lấy userId từ token xác thực
    const { limit = 50, skip = 0 } = req.query; // Lấy query params cho phân trang

    // Kiểm tra userId hợp lệ
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return next(new AppError('Người dùng không hợp lệ hoặc đã bị xóa', 400));
    }

    // Truy vấn thông báo với phân trang
    const notifications = await NotificationUser.find({
      userId,
      isDeleted: false,
    })
      .populate({
        path: 'notificationId',
        match: { isDeleted: false },
        select:
          'title content type targetUserId targetWorkspaceId createdBy audienceType createdAt eventId taskId messageId',
      })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    // Lọc và định dạng kết quả
    const formattedNotifications = notifications
      .filter((n) => n.notificationId) // Loại bỏ nếu notificationId không tồn tại
      .map((n) => ({
        notificationId: n.notificationId._id,
        title: n.notificationId.title,
        content: n.notificationId.content,
        type: n.notificationId.type,
        targetUserId: n.notificationId.targetUserId,
        targetWorkspaceId: n.notificationId.targetWorkspaceId,
        createdBy: n.notificationId.createdBy,
        audienceType: n.notificationId.audienceType,
        createdAt: n.notificationId.createdAt,
        eventId: n.notificationId.eventId,
        taskId: n.notificationId.taskId,
        messageId: n.notificationId.messageId,
        isRead: n.isRead,
        readAt: n.readAt ? n.readAt : null,
        relatedUserId: n.relatedUserId,
      }));

    res.status(200).json({
      status: 'success',
      results: formattedNotifications.length,
      data: {
        notifications: formattedNotifications,
      },
    });
  } catch (error) {
    next(new AppError(`Lỗi khi lấy thông báo: ${error.message}`, 500));
  }
};

exports.markAsRead = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user._id; // Lấy userId từ token xác thực
    const { notificationId } = req.params; // Lấy notificationId từ URL params

    // Kiểm tra thông báo hợp lệ
    const notificationUser = await NotificationUser.findOne({
      notificationId,
      userId,
      isRead: false,
      isDeleted: false,
    }).session(session);

    if (!notificationUser) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new AppError(
          'Thông báo không tồn tại, đã được đọc, hoặc không thuộc về bạn',
          404
        )
      );
    }

    // Cập nhật trạng thái đọc
    notificationUser.isRead = true;
    notificationUser.readAt = new Date();
    await notificationUser.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: {
        notificationUser,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    next(new AppError(`Lỗi khi đánh dấu thông báo: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
};
