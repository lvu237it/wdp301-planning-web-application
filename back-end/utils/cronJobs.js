const cron = require('node-cron');
const Event = require('../models/eventModel');
const EventHistory = require('../models/eventHistoryModel');

// Helper function để xác định trạng thái sự kiện dựa trên thời gian
const determineEventStatus = (startDate, endDate, currentStatus) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Nếu sự kiện đã được hủy hoặc đã hoàn thành thủ công, giữ nguyên
  if (currentStatus === 'cancelled') {
    return currentStatus;
  }

  // Nếu sự kiện đã kết thúc
  if (now > end) {
    return 'completed';
  }

  // Nếu sự kiện đang diễn ra
  if (now >= start && now <= end) {
    return 'in-progress';
  }

  // Nếu sự kiện chưa bắt đầu
  if (now < start) {
    return 'scheduled';
  }

  return currentStatus;
};

// Hàm chạy scheduled job để cập nhật trạng thái sự kiện cho tất cả users
const updateAllEventsStatus = async () => {
  try {
    console.log('🔄 Starting scheduled event status update for all users...');
    const startTime = Date.now();

    // Lấy tất cả sự kiện cần cập nhật (không phải cancelled và chưa bị xóa)
    const eventsToUpdate = await Event.find({
      isDeleted: false,
      status: { $nin: ['cancelled', 'completed'] }, // Không cập nhật sự kiện đã hủy hoặc đã hoàn thành
    }).select('_id title startDate endDate status organizer participants');

    if (eventsToUpdate.length === 0) {
      console.log('✅ No events need status update');
      return {
        success: true,
        message: 'No events need update',
        updatedCount: 0,
      };
    }

    const now = new Date();
    const eventUpdates = [];
    const historyRecords = [];
    const eventsChanged = [];

    // Phân loại và chuẩn bị bulk update
    for (const event of eventsToUpdate) {
      const newStatus = determineEventStatus(
        event.startDate,
        event.endDate,
        event.status
      );

      if (newStatus !== event.status) {
        eventsChanged.push({
          eventId: event._id,
          title: event.title,
          oldStatus: event.status,
          newStatus: newStatus,
          organizer: event.organizer,
        });

        eventUpdates.push({
          updateOne: {
            filter: { _id: event._id },
            update: {
              $set: {
                status: newStatus,
                updatedAt: now,
              },
            },
          },
        });

        // Tạo history record
        historyRecords.push({
          eventId: event._id,
          action: 'scheduled_auto_update_status',
          participants: event.participants.map((p) => ({
            userId: p.userId,
            status: p.status,
          })),
        });
      }
    }

    let updatedCount = 0;

    // Thực hiện bulk update
    if (eventUpdates.length > 0) {
      try {
        const bulkResult = await Event.bulkWrite(eventUpdates, {
          ordered: false,
        });
        updatedCount = bulkResult.modifiedCount;

        // Batch insert event history
        if (historyRecords.length > 0) {
          await EventHistory.insertMany(historyRecords);
        }

        // Gửi thông báo real-time cho các users liên quan
        try {
          const { emitToUser } = require('./socket');

          // Group events by organizer and participants
          const userNotifications = new Map();

          for (const event of eventsChanged) {
            // Notify organizer
            if (!userNotifications.has(event.organizer.toString())) {
              userNotifications.set(event.organizer.toString(), []);
            }
            userNotifications.get(event.organizer.toString()).push(event);

            // Notify accepted participants
            const originalEvent = eventsToUpdate.find(
              (e) => e._id.toString() === event.eventId.toString()
            );
            for (const participant of originalEvent.participants) {
              if (
                participant.status === 'accepted' &&
                participant.userId.toString() !== event.organizer.toString()
              ) {
                if (!userNotifications.has(participant.userId.toString())) {
                  userNotifications.set(participant.userId.toString(), []);
                }
                userNotifications
                  .get(participant.userId.toString())
                  .push(event);
              }
            }
          }

          // Send notifications
          for (const [userId, userEvents] of userNotifications) {
            emitToUser(userId, 'events_status_updated_scheduled', {
              updatedCount: userEvents.length,
              events: userEvents,
              totalUpdated: updatedCount,
            });
          }
        } catch (socketError) {
          console.warn(
            'Failed to emit socket notifications:',
            socketError.message
          );
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(
          `✅ Scheduled update completed: ${updatedCount}/${eventsToUpdate.length} events updated in ${duration}ms`
        );

        return {
          success: true,
          message: `Successfully updated ${updatedCount} events`,
          updatedCount,
          totalEvents: eventsToUpdate.length,
          duration,
          events: eventsChanged,
        };
      } catch (bulkError) {
        console.error('❌ Scheduled bulk update failed:', bulkError);
        return {
          success: false,
          error: bulkError.message,
          updatedCount: 0,
        };
      }
    } else {
      console.log('✅ All events already have correct status');
      return {
        success: true,
        message: 'All events already have correct status',
        updatedCount: 0,
        totalEvents: eventsToUpdate.length,
      };
    }
  } catch (error) {
    console.error('❌ Scheduled event status update failed:', error);
    return {
      success: false,
      error: error.message,
      updatedCount: 0,
    };
  }
};

// Khởi tạo và quản lý tất cả các cron jobs
const initializeCronJobs = () => {
  // Chỉ chạy cron jobs trong production hoặc khi được enable explicitly
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ENABLE_CRON === 'true'
  ) {
    // Cron job cập nhật trạng thái sự kiện mỗi 15 phút
    cron.schedule(
      '*/15 * * * *',
      async () => {
        console.log('🕐 Running scheduled event status update...');
        try {
          const result = await updateAllEventsStatus();
          if (result.success && result.updatedCount > 0) {
            console.log(
              `✅ Scheduled job completed: Updated ${result.updatedCount} events in ${result.duration}ms`
            );
          } else if (result.success) {
            console.log(
              '✅ Scheduled job completed: All events already have correct status'
            );
          } else {
            console.error('❌ Scheduled job failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Scheduled job error:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh',
      }
    );

    console.log(
      '📅 Event status update cron job scheduled to run every 15 minutes'
    );

    // Có thể thêm thêm cron jobs khác ở đây
    // Ví dụ: cron job dọn dẹp notifications cũ, reminder emails, etc.
  } else {
    console.log(
      '📅 Cron jobs disabled (development mode). Set ENABLE_CRON=true to enable.'
    );
  }
};

// Export các functions để có thể test hoặc gọi manual
module.exports = {
  initializeCronJobs,
  updateAllEventsStatus,
  determineEventStatus,
};
