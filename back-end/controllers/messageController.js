const Task = require('../models/taskModel');
const Event = require('../models/eventModel');
const Notification = require('../models/notificationModel');
const NotificationUser = require('../models/notificationUserModel');
const NotificationService = require('../services/NotificationService');

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

    // Tạo thông báo cho từng người nhận bằng NotificationService
    const notificationPromises = targetUsers.map((userId) =>
      NotificationService.createPersonalNotification({
        title: `Tin nhắn mới trong ${
          eventId ? 'sự kiện' : 'nhiệm vụ'
        } ${contextTitle}`,
        content: `Bạn nhận được một tin nhắn mới từ ${
          message.userId
        }: ${message.content.substring(0, 100)}...`,
        type: 'new_message',
        targetUserId: userId,
        createdBy: message.userId,
        relatedUserId: message.userId,
        eventId: eventId || null,
        taskId: taskId || null,
        messageId: message._id,
      })
    );

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
