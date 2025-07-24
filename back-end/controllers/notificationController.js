const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const User = require('../models/userModel');
const NotificationUser = require('../models/notificationUserModel');
const Event = require('../models/eventModel');
const Membership = require('../models/memberShipModel');

// Helper function để format date theo format Việt Nam
const formatDateForVN = (date) => {
  if (!date) return null;

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(d);
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

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
          'title content type targetUserId targetWorkspaceId boardId createdBy audienceType createdAt eventId taskId messageId',
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
            select: 'fullname avatar username',
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
            // Nếu content là JSON (do workspace_invite), parse ra
            ...(function () {
              try {
                const parsed = JSON.parse(n.notificationId.content);
                return {
                  content: parsed.content || n.notificationId.content,
                  invitationToken: parsed.invitationToken,
                };
              } catch (e) {
                return { content: n.notificationId.content };
              }
            })(),
            type: n.notificationId.type,
            targetUserId: n.notificationId.targetUserId,
            targetWorkspaceId: n.notificationId.targetWorkspaceId,
            boardId: n.notificationId.boardId,
            createdBy: {
              userId: n.notificationId.createdBy?._id,
              fullname: n.notificationId.createdBy?.fullname,
              username: n.notificationId.createdBy?.username,
              avatar: n.notificationId.createdBy?.avatar,
            },
            audienceType: n.notificationId.audienceType,
            createdAt: n.notificationId.createdAt,
            eventId: n.notificationId.eventId,
            taskId: n.notificationId.taskId,
            messageId: n.notificationId.messageId,
            isRead: n.isRead,
            readAt: n.readAt ? formatDateForVN(n.readAt) : null,
            relatedUserId: n.relatedUserId,
            responseStatus: null, // Default value
            responded: false, // Default value
          };

          // Nếu là event invitation, lấy participant status FROM EVENT HIỆN TẠI
          if (
            n.notificationId.type === 'event_invitation' &&
            n.notificationId.eventId
          ) {
            try {
              const event = await Event.findById(n.notificationId.eventId);
              if (event && !event.isDeleted) {
                const participant = event.participants.find(
                  (p) => p.userId.toString() === userId.toString()
                );
                if (participant) {
                  baseNotification.responseStatus = participant.status;
                  baseNotification.responded = participant.status !== 'pending';

                  console.log(
                    `📝 Event invitation status for user ${userId}:`,
                    {
                      eventId: n.notificationId.eventId,
                      participantStatus: participant.status,
                      responded: participant.status !== 'pending',
                    }
                  );
                } else {
                  // Người dùng không còn trong danh sách participants (có thể bị remove)
                  baseNotification.responseStatus = 'removed';
                  baseNotification.responded = true;
                }
              } else {
                // Event không tồn tại hoặc đã bị xóa
                baseNotification.responseStatus = 'event_deleted';
                baseNotification.responded = true;
              }
            } catch (error) {
              console.warn('Error fetching event participant status:', error);
              baseNotification.responseStatus = 'error';
              baseNotification.responded = false;
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

          // Nếu là workspace_invite, lấy trạng thái từ Membership
          if (
            n.notificationId.type === 'workspace_invite' &&
            n.notificationId.targetWorkspaceId
          ) {
            try {
              const membership = await Membership.findOne({
                workspaceId: n.notificationId.targetWorkspaceId,
                userId: userId,
              });
              if (membership) {
                baseNotification.invitationResponse =
                  membership.invitationStatus;
              }
            } catch (err) {
              baseNotification.invitationResponse = undefined;
            }
          }
          // Nếu là board_invite, lấy trạng thái từ BoardMembership
          if (n.notificationId.type === 'board_invite') {
            try {
              const boardMembership =
                await require('../models/boardMembershipModel').findOne({
                  boardId: n.notificationId.boardId,
                  userId: userId,
                });
              if (boardMembership) {
                baseNotification.invitationResponse =
                  boardMembership.invitationResponse;
                baseNotification.isDeleted = boardMembership.isDeleted;
                // Nếu membership đã bị xóa, đánh dấu để loại bỏ ở bước filter phía dưới
                if (boardMembership.isDeleted) {
                  baseNotification._shouldHide = true;
                }
              } else {
                // Nếu không tìm thấy membership, cũng ẩn
                baseNotification._shouldHide = true;
              }
            } catch (err) {
              baseNotification.invitationResponse = undefined;
              baseNotification.isDeleted = undefined;
              baseNotification._shouldHide = true;
            }
          }

          return baseNotification;
        })
    );

    // Chỉ giữ lại thông báo board_invite mới nhất cho mỗi cặp (boardId, userId)
    const seenBoardInvites = new Map(); // key: boardId, value: notification (giữ notificationId lớn nhất)
    const filteredNotifications = [];
    for (const notif of formattedNotifications) {
      if (notif.type === 'board_invite') {
        if (notif._shouldHide) continue;
        const key = notif.boardId?.toString?.() || '';
        // Nếu đã có boardId này, so sánh createdAt để giữ cái mới nhất
        if (!seenBoardInvites.has(key)) {
          seenBoardInvites.set(key, notif);
        } else {
          // So sánh createdAt
          const prev = seenBoardInvites.get(key);
          if (new Date(notif.createdAt) > new Date(prev.createdAt)) {
            seenBoardInvites.set(key, notif);
          }
        }
      } else {
        filteredNotifications.push(notif);
      }
    }
    // Thêm các board_invite mới nhất vào danh sách
    for (const notif of seenBoardInvites.values()) {
      filteredNotifications.push(notif);
    }
    // Sắp xếp lại theo thời gian tạo (giảm dần)
    filteredNotifications.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Tính toán pagination info
    const hasMore = skipNum + limitNum < totalCount;
    const currentPage = Math.floor(skipNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      status: 'success',
      results: filteredNotifications.length,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        hasMore,
        limit: limitNum,
        skip: skipNum,
      },
      data: {
        notifications: filteredNotifications,
      },
    });
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    next(new AppError(`Lỗi khi lấy thông báo: ${error.message}`, 500));
  }
};

exports.markAsRead = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user._id; // Lấy userId từ token xác thực
    const { notificationId } = req.params; // Lấy notificationId từ URL params

    console.log(`📖 Marking notification as read:`, {
      notificationId,
      userId: userId.toString(),
    });

    // Kiểm tra thông báo hợp lệ
    const notificationUser = await NotificationUser.findOne({
      notificationId,
      userId,
      isDeleted: false,
    }).session(session);

    if (!notificationUser) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new AppError('Thông báo không tồn tại hoặc không thuộc về bạn', 404)
      );
    }

    // Chỉ cập nhật nếu chưa được đọc
    if (!notificationUser.isRead) {
      notificationUser.isRead = true;
      notificationUser.readAt = new Date();
      await notificationUser.save({ session });

      console.log(`✅ Notification marked as read:`, {
        notificationId,
        userId: userId.toString(),
        readAt: notificationUser.readAt,
      });
    } else {
      console.log(`ℹ️ Notification already read:`, {
        notificationId,
        userId: userId.toString(),
      });
    }

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      message: 'Đã đánh dấu thông báo là đã đọc',
      data: {
        notificationId: notificationUser.notificationId,
        isRead: notificationUser.isRead,
        readAt: formatDateForVN(notificationUser.readAt),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in markAsRead:', error);
    next(new AppError(`Lỗi khi đánh dấu thông báo: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
};
