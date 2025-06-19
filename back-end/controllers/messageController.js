const mongoose = require('mongoose');
const Task = require('../models/taskModel');
const Event = require('../models/eventModel');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const NotificationUser = require('../models/notificationUserModel');
const NotificationService = require('../services/NotificationService');
const AppError = require('../utils/appError');
const { getIO, getOfflineUsers } = require('../utils/socket');

// Tạo tin nhắn mới trong event
exports.createEventMessage = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
      return next(new AppError('Nội dung tin nhắn không được để trống', 400));
    }

    // Kiểm tra event tồn tại và hợp lệ
    const event = await Event.findOne({
      _id: eventId,
      isDeleted: false,
      status: { $nin: ['draft', 'completed', 'cancelled'] },
    });

    if (!event) {
      return next(
        new AppError('Sự kiện không tồn tại hoặc không cho phép chat', 404)
      );
    }

    // Kiểm tra user có phải là participant đã accepted không
    const participant = event.participants.find(
      (p) =>
        p.userId.toString() === userId.toString() && p.status === 'accepted'
    );

    if (!participant && event.organizer.toString() !== userId.toString()) {
      return next(
        new AppError('Bạn không có quyền gửi tin nhắn trong sự kiện này', 403)
      );
    }

    // Tạo tin nhắn
    const message = await Message.create({
      eventId,
      userId,
      content: content.trim(),
    });

    // Populate thông tin user
    await message.populate('userId', 'fullname username avatar');

    // Gửi thông báo real-time cho các participants khác
    const io = getIO();
    const acceptedParticipants = event.participants
      .filter(
        (p) =>
          p.status === 'accepted' && p.userId.toString() !== userId.toString()
      )
      .map((p) => p.userId.toString());

    // Thêm organizer nếu không phải là người gửi
    if (event.organizer.toString() !== userId.toString()) {
      acceptedParticipants.push(event.organizer.toString());
    }

    // Emit tin nhắn real-time qua custom event
    acceptedParticipants.forEach((participantId) => {
      io.to(participantId).emit('new_event_message', {
        eventId,
        message: {
          _id: message._id,
          content: message.content,
          userId: {
            _id: message.userId._id,
            fullname: message.userId.fullname,
            username: message.userId.username,
            avatar: message.userId.avatar,
          },
          createdAt: message.createdAt,
        },
      });
    });

    // Gửi thông báo real-time tới notification bell cho tất cả user (cả online và offline)
    const senderName =
      message.userId.fullname || message.userId.username || 'Ai đó';
    const notificationData = {
      eventId: eventId,
      title: `Tin nhắn mới trong sự kiện "${event.title}"`,
      content: `${senderName} đã gửi: ${message.content.substring(0, 80)}${
        message.content.length > 80 ? '...' : ''
      }`,
      type: 'new_message',
      createdBy: message.userId._id,
      messageId: message._id,
    };

    acceptedParticipants.forEach((participantId) => {
      io.to(participantId).emit('new_notification', notificationData);
    });

    // Tạo thông báo cho tất cả người tham gia (cả online và offline)
    await exports.createMessageNotification(message, eventId, null);

    res.status(201).json({
      status: 'success',
      data: {
        message: {
          _id: message._id,
          content: message.content,
          userId: {
            _id: message.userId._id,
            fullname: message.userId.fullname,
            username: message.userId.username,
            avatar: message.userId.avatar,
          },
          createdAt: message.createdAt,
        },
      },
    });
  } catch (error) {
    next(new AppError(`Lỗi khi tạo tin nhắn: ${error.message}`, 500));
  }
};

// Lấy tin nhắn của event
exports.getEventMessages = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { limit = 50, skip = 0, before } = req.query; // Thêm before parameter
    const userId = req.user._id;

    // Kiểm tra event tồn tại
    const event = await Event.findOne({
      _id: eventId,
      isDeleted: false,
    });

    if (!event) {
      return next(new AppError('Sự kiện không tồn tại', 404));
    }

    // Kiểm tra user có quyền xem tin nhắn không
    const participant = event.participants.find(
      (p) =>
        p.userId.toString() === userId.toString() && p.status === 'accepted'
    );

    if (!participant && event.organizer.toString() !== userId.toString()) {
      return next(
        new AppError('Bạn không có quyền xem tin nhắn trong sự kiện này', 403)
      );
    }

    // Lấy tổng số tin nhắn để tính pagination
    const totalMessages = await Message.countDocuments({
      eventId,
      isDeleted: false,
    });

    // Build query với cursor-based pagination
    let query = {
      eventId,
      isDeleted: false,
    };

    // Nếu có 'before' parameter, lấy messages cũ hơn timestamp đó
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Lấy tin nhắn với cursor-based pagination
    const messages = await Message.find(query)
      .populate('userId', 'fullname username avatar')
      .sort({ createdAt: -1 }) // Sort descending để lấy newest trước
      .limit(parseInt(limit))
      .select('content userId createdAt isEdited editedAt')
      .lean();

    // Reverse để có oldest first cho frontend
    messages.reverse();

    // Determine if there are more messages
    const hasMore = messages.length === parseInt(limit);
    const oldestMessageTime =
      messages.length > 0 ? messages[0].createdAt : null;

    res.status(200).json({
      status: 'success',
      results: messages.length,
      data: {
        messages,
        canSendMessage:
          event.status &&
          !['draft', 'completed', 'cancelled'].includes(event.status),
        pagination: {
          total: totalMessages,
          limit: parseInt(limit),
          hasMore,
          oldestMessageTime, // Cursor cho lần load more tiếp theo
        },
      },
    });
  } catch (error) {
    next(new AppError(`Lỗi khi lấy tin nhắn: ${error.message}`, 500));
  }
};

// Chỉnh sửa tin nhắn (chỉ người gửi)
exports.editEventMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
      return next(new AppError('Nội dung tin nhắn không được để trống', 400));
    }

    const message = await Message.findOne({
      _id: messageId,
      isDeleted: false,
    }).populate('eventId');

    if (!message) {
      return next(new AppError('Tin nhắn không tồn tại', 404));
    }

    // Chỉ người gửi mới có thể chỉnh sửa
    if (message.userId.toString() !== userId.toString()) {
      return next(
        new AppError('Bạn chỉ có thể chỉnh sửa tin nhắn của mình', 403)
      );
    }

    // Cập nhật tin nhắn
    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Populate thông tin user
    await message.populate('userId', 'fullname username avatar');

    // Emit real-time update
    const io = getIO();
    const event = message.eventId;
    const acceptedParticipants = event.participants
      .filter(
        (p) =>
          p.status === 'accepted' && p.userId.toString() !== userId.toString()
      )
      .map((p) => p.userId.toString());

    // Thêm organizer nếu không phải là người edit
    if (event.organizer.toString() !== userId.toString()) {
      acceptedParticipants.push(event.organizer.toString());
    }

    acceptedParticipants.forEach((participantId) => {
      io.to(participantId).emit('edit_event_message', {
        eventId: event._id,
        message: {
          _id: message._id,
          content: message.content,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          userId: {
            _id: message.userId._id,
            fullname: message.userId.fullname,
            username: message.userId.username,
            avatar: message.userId.avatar,
          },
          createdAt: message.createdAt,
        },
      });
    });

    res.status(200).json({
      status: 'success',
      data: {
        message: {
          _id: message._id,
          content: message.content,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          userId: {
            _id: message.userId._id,
            fullname: message.userId.fullname,
            username: message.userId.username,
            avatar: message.userId.avatar,
          },
          createdAt: message.createdAt,
        },
      },
    });
  } catch (error) {
    next(new AppError(`Lỗi khi chỉnh sửa tin nhắn: ${error.message}`, 500));
  }
};

// Xóa tin nhắn (chỉ người gửi hoặc organizer)
exports.deleteEventMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      isDeleted: false,
    }).populate('eventId');

    if (!message) {
      return next(new AppError('Tin nhắn không tồn tại', 404));
    }

    // Chỉ người gửi mới có thể xóa tin nhắn của mình
    if (message.userId.toString() !== userId.toString()) {
      return next(
        new AppError('Bạn chỉ có thể xóa tin nhắn của chính mình', 403)
      );
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Emit real-time deletion
    const io = getIO();
    const event = message.eventId;
    const acceptedParticipants = event.participants
      .filter(
        (p) =>
          p.status === 'accepted' && p.userId.toString() !== userId.toString()
      )
      .map((p) => p.userId.toString());

    // Thêm organizer nếu không phải là người delete
    if (event.organizer.toString() !== userId.toString()) {
      acceptedParticipants.push(event.organizer.toString());
    }

    acceptedParticipants.forEach((participantId) => {
      io.to(participantId).emit('delete_event_message', {
        eventId: event._id,
        messageId: message._id,
      });
    });

    res.status(200).json({
      status: 'success',
      message: 'Tin nhắn đã được xóa',
    });
  } catch (error) {
    next(new AppError(`Lỗi khi xóa tin nhắn: ${error.message}`, 500));
  }
};

// Trong hàm xử lý tạo tin nhắn (giả sử trong messageController)
exports.createMessageNotification = async (message, eventId, taskId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let targetUsers = [];
    let contextTitle = '';

    // Xác định người nhận thông báo và tiêu đề ngữ cảnh
    if (eventId) {
      const event = await Event.findById(eventId).session(session);
      if (event) {
        contextTitle = event.title;
        targetUsers = event.participants
          .filter(
            (p) =>
              p.status === 'accepted' &&
              p.userId.toString() !== message.userId.toString()
          )
          .map((p) => p.userId);
      }
    } else if (taskId) {
      const task = await Task.findById(taskId).session(session);
      if (task && task.assignedTo) {
        contextTitle = task.title;
        targetUsers = [task.assignedTo].filter(
          (userId) => userId.toString() !== message.userId.toString()
        );
      }
    }

    if (targetUsers.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Gửi notification cho tất cả người dùng (cả online và offline)
    // Vì thông báo sẽ hiển thị trong notification bell ngay cả khi user đang online
    const notificationPromises = targetUsers.map(async (userId) => {
      const user = await User.findById(message.userId, 'username fullname');
      const senderName = user?.fullname || user?.username || 'Ai đó';

      return NotificationService.createPersonalNotification({
        title: `Tin nhắn mới trong ${
          eventId ? 'sự kiện' : 'nhiệm vụ'
        } "${contextTitle}"`,
        content: `${senderName} đã gửi: ${message.content.substring(0, 80)}${
          message.content.length > 80 ? '...' : ''
        }`,
        type: 'new_message',
        targetUserId: userId,
        createdBy: message.userId,
        relatedUserId: message.userId,
        eventId: eventId || null,
        taskId: taskId || null,
        messageId: message._id,
      });
    });

    await Promise.all(notificationPromises);

    await session.commitTransaction();
    console.log(
      `✅ Đã tạo thông báo tin nhắn cho ${targetUsers.length} người dùng`
    );
  } catch (error) {
    await session.abortTransaction();
    throw new AppError(`Lỗi khi tạo thông báo tin nhắn: ${error.message}`, 500);
  } finally {
    session.endSession();
  }
};
