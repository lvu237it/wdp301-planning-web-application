const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const User = require('../models/userModel');
const NotificationUser = require('../models/notificationUserModel');
const Event = require('../models/eventModel');

exports.getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { limit = 50, skip = 0 } = req.query;
    const limitNum = parseInt(limit);
    const skipNum = parseInt(skip);

    // Kiểm tra userId hợp lệ
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return next(new AppError('Người dùng không hợp lệ hoặc đã bị xóa', 400));
    }

    // Đếm tổng số thông báo
    const totalCount = await NotificationUser.countDocuments({
      userId,
      isDeleted: false,
    });

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
        populate: [
          {
            path: 'messageId',
            model: 'Message',
            select: 'content userId eventId taskId createdAt',
            match: { isDeleted: false },
            populate: [
              {
                path: 'userId',
                model: 'User',
                select: 'fullname avatar',
              },
              {
                path: 'eventId',
                model: 'Event',
                select: 'title',
              },
              {
                path: 'taskId',
                model: 'Task',
                select: 'title',
              },
            ],
          },
          {
            path: 'createdBy',
            model: 'User',
            select: 'fullname avatar',
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .lean();

    // Định dạng kết quả
    const formattedNotifications = await Promise.all(
      notifications
        .filter((n) => n.notificationId)
        .map(async (n) => {
          const baseNotification = {
            notificationId: n.notificationId._id,
            title: n.notificationId.title,
            content: n.notificationId.content,
            type: n.notificationId.type,
            targetUserId: n.notificationId.targetUserId,
            targetWorkspaceId: n.notificationId.targetWorkspaceId,
            createdBy: {
              userId: n.notificationId.createdBy?._id,
              fullname: n.notificationId.createdBy?.fullname,
              avatar: n.notificationId.createdBy?.avatar,
            },
            audienceType: n.notificationId.audienceType,
            createdAt: formatDateToTimeZone(n.notificationId.createdAt),
            eventId: n.notificationId.eventId,
            taskId: n.notificationId.taskId,
            messageId: n.notificationId.messageId,
            isRead: n.isRead,
            readAt: n.readAt ? n.readAt : null,
            relatedUserId: n.relatedUserId,
          };

          // Nếu là event invitation, lấy participant status
          if (
            n.notificationId.type === 'event_invitation' &&
            n.notificationId.eventId
          ) {
            try {
              const event = await Event.findById(n.notificationId.eventId);
              if (event) {
                const participant = event.participants.find(
                  (p) => p.userId.toString() === userId.toString()
                );
                if (participant) {
                  baseNotification.responseStatus = participant.status;
                  baseNotification.responded = participant.status !== 'pending';
                }
              }
            } catch (error) {
              console.warn('Error fetching event participant status:', error);
            }
          }

          // Nếu là thông báo liên quan đến tin nhắn
          if (
            n.notificationId.type === 'new_message' &&
            n.notificationId.messageId &&
            typeof n.notificationId.messageId === 'object'
          ) {
            baseNotification.message = {
              content: n.notificationId.messageId.content,
              sender: {
                userId: n.notificationId.messageId.userId?._id,
                fullname: n.notificationId.messageId.userId?.fullname,
                avatar: n.notificationId.messageId.userId?.avatar,
              },
              event: n.notificationId.messageId.eventId
                ? {
                    eventId: n.notificationId.messageId.eventId._id,
                    title: n.notificationId.messageId.eventId.title,
                  }
                : null,
              task: n.notificationId.messageId.taskId
                ? {
                    taskId: n.notificationId.messageId.taskId._id,
                    title: n.notificationId.messageId.taskId.title,
                  }
                : null,
              createdAt: n.notificationId.messageId.createdAt,
            };
          }

          return baseNotification;
        })
    );

    // Tính toán pagination info
    const hasMore = skipNum + limitNum < totalCount;
    const currentPage = Math.floor(skipNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      status: 'success',
      results: formattedNotifications.length,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        hasMore,
        limit: limitNum,
        skip: skipNum,
      },
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
