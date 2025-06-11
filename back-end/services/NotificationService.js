const mongoose = require('mongoose');
const { getIO } = require('../utils/socket');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const AppError = require('../utils/appError');
const Notification = require('../models/notificationModel');
const NotificationUser = require('../models/notificationUserModel');
const Membership = require('../models/memberShipModel');
const User = require('../models/userModel');
const { getAdminId } = require('../utils/admin');

class NotificationService {
  // Gửi thông báo cá nhân - dành cho một người dùng cụ thể
  static async createPersonalNotification({
    title,
    content,
    type,
    targetUserId,
    targetWorkspaceId = null,
    createdBy,
    relatedUserId = null,
    eventId = null,
    taskId = null,
    messageId = null,
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Kiểm tra userId hợp lệ
      const user = await User.findOne({
        _id: targetUserId,
        isDeleted: false,
      }).session(session);
      if (!user) {
        throw new AppError(
          'Người nhận thông báo không hợp lệ hoặc đã bị xóa',
          400
        );
      }

      // Tạo thông báo
      const [notification] = await Notification.create(
        [
          {
            title,
            content,
            type,
            audienceType: 'personal',
            targetUserId,
            targetWorkspaceId,
            createdBy,
            eventId,
            taskId,
            messageId,
          },
        ],
        { session }
      );

      // Tạo liên kết trong NotificationUser
      await NotificationUser.create(
        [
          {
            notificationId: notification._id,
            userId: targetUserId,
            relatedUserId: relatedUserId || null,
            isRead: false,
          },
        ],
        { session }
      );

      // Gửi thông báo real-time qua Socket.IO
      const io = getIO();
      io.to(targetUserId.toString()).emit('new_notification', {
        notificationId: notification._id,
        title,
        content,
        type,
        targetUserId,
        targetWorkspaceId,
        createdBy,
        relatedUserId,
        eventId,
        taskId,
        messageId,
        audienceType: 'personal',
        createdAt: notification.createdAt,
      });

      console.log(
        `NotificationService: Đã tạo thông báo ${type} cho user ${targetUserId}`
      );
      await session.commitTransaction();
      return notification;
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(`Lỗi khi tạo thông báo: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }

  // Gửi thông báo cho workspace - dành cho tất cả thành viên trong một workspace
  static async createWorkspaceNotification({
    title,
    content,
    type,
    targetWorkspaceId,
    createdBy,
    relatedUserId = null,
    eventId = null,
    taskId = null,
    messageId = null,
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Kiểm tra workspace hợp lệ
      const workspace = await mongoose
        .model('Workspace')
        .findOne({ _id: targetWorkspaceId, isDeleted: false })
        .session(session);
      if (!workspace) {
        throw new AppError('Workspace không hợp lệ hoặc đã bị xóa', 400);
      }

      // Tạo thông báo
      const [notification] = await Notification.create(
        [
          {
            title,
            content,
            type,
            audienceType: 'workspace',
            targetWorkspaceId,
            createdBy,
            eventId,
            taskId,
            messageId,
          },
        ],
        { session }
      );

      // Lấy danh sách thành viên trong workspace
      const members = await Membership.find({
        workspaceId: targetWorkspaceId,
        isDeleted: false,
      }).session(session);
      if (!members.length) {
        throw new AppError('Workspace không có thành viên', 400);
      }

      // Tạo liên kết trong NotificationUser cho từng thành viên
      const notificationUsers = members.map((member) => ({
        notificationId: notification._id,
        userId: member.userId,
        relatedUserId: relatedUserId || null,
        isRead: false,
      }));
      await NotificationUser.insertMany(notificationUsers, { session });

      // Gửi thông báo real-time qua Socket.IO
      const io = getIO();
      io.to(`workspace_${targetWorkspaceId}`).emit('new_notification', {
        notificationId: notification._id,
        title,
        content,
        type,
        targetWorkspaceId,
        createdBy,
        relatedUserId,
        eventId,
        taskId,
        messageId,
        audienceType: 'workspace',
        createdAt: notification.createdAt,
      });

      console.log(
        `NotificationService: Đã tạo thông báo ${type} cho workspace ${targetWorkspaceId}`
      );
      await session.commitTransaction();
      return notification;
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(`Lỗi khi tạo thông báo nhóm: ${error.message}`, 500);
    } finally {
      session.endSession();
    }
  }

  // Gửi thông báo toàn cục - dành cho tất cả người dùng trong hệ thống
  static async createGlobalNotification({
    title,
    content,
    type,
    eventId = null,
    taskId = null,
    messageId = null,
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Lấy adminId từ admin.js
      let createdBy;
      try {
        createdBy = getAdminId();
      } catch (error) {
        throw new AppError(`Lỗi khi lấy admin ID: ${error.message}`, 500);
      }

      // Kiểm tra admin hợp lệ
      const admin = await User.findOne({
        _id: createdBy,
        isDeleted: false,
      }).session(session);
      if (!admin) {
        throw new AppError('Admin không hợp lệ hoặc đã bị xóa', 400);
      }

      // Tạo thông báo
      const [notification] = await Notification.create(
        [
          {
            title,
            content,
            type,
            audienceType: 'global',
            createdBy,
            eventId,
            taskId,
            messageId,
          },
        ],
        { session }
      );

      // Lấy tất cả người dùng
      const users = await User.find({ isDeleted: false }).session(session);
      if (!users.length) {
        throw new AppError('Không có người dùng nào trong hệ thống', 400);
      }

      // Tạo liên kết trong NotificationUser cho tất cả người dùng
      const notificationUsers = users.map((user) => ({
        notificationId: notification._id,
        userId: user._id,
        isRead: false,
      }));
      await NotificationUser.insertMany(notificationUsers, { session });

      // Gửi thông báo real-time qua Socket.IO
      const io = getIO();
      users.forEach((user) => {
        io.to(user._id.toString()).emit('new_notification', {
          notificationId: notification._id,
          title,
          content,
          type,
          createdBy,
          eventId,
          taskId,
          messageId,
          audienceType: 'global',
          createdAt: notification.createdAt,
        });
      });

      console.log(`NotificationService: Đã tạo thông báo toàn cục ${type}`);
      await session.commitTransaction();
      return notification;
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(
        `Lỗi khi tạo thông báo toàn cục: ${error.message}`,
        500
      );
    } finally {
      session.endSession();
    }
  }
}

module.exports = NotificationService;
