const Event = require('../models/eventModel');
const EventHistory = require('../models/eventHistoryModel');
const Notification = require('../models/notificationModel');
const Email = require('../models/emailModel');
const File = require('../models/fileModel');
const Message = require('../models/messageModel');
const Calendar = require('../models/calendarModel');
const sendMail = require('../utils/sendMail');
const Workspace = require('../models/workspaceModel');
const Board = require('../models/boardModel');
const BoardMembership = require('../models/boardMembershipModel');
const { formatDateToTimeZone } = require('../utils/dateUtils');

exports.createEventForCalendar = async (req, res) => {
  try {
    const {
      title,
      description,
      locationName,
      address,
      type,
      onlineUrl,
      meetingCode,
      startDate,
      endDate,
      recurrence,
      timeZone,
      workspaceId,
      boardId,
      reminderSettings,
      status,
      category,
      color,
      allDay,
    } = req.body;
    const { calendarId } = req.params;
    const organizer = req.user._id; // Lấy ID người dùng từ token đã xác thực
    let participants = req.body.participants || [];
    participants.push({ userId: organizer, status: 'accepted' }); // Tự động thêm người tạo sự kiện là người tham gia

    // Kiểm tra các trường bắt buộc
    if (
      !title ||
      !calendarId ||
      !startDate ||
      !endDate ||
      !organizer ||
      !type
    ) {
      return res.status(400).json({
        message:
          'Thiếu các trường bắt buộc: title, calendarId, startDate, endDate, organizer hoặc type',
        status: 400,
      });
    }

    //Check calendarId có tồn tại không - isDeleted = false
    const calendar = await Calendar.findById(calendarId);
    if (!calendar || calendar.isDeleted) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch với calendarId đã cho',
        status: 404,
      });
    }

    //Nếu board tồn tại, kiểm tra workspace, và kiểm tra board có tồn tại trong workspace đó ko
    if (boardId) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace || workspace.isDeleted) {
        return res.status(404).json({
          message: 'Không tìm thấy workspace với workspaceId đã cho',
          status: 404,
        });
      }

      const board = await Board.findById(boardId, {
        isDeleted: false,
      });
      if (!board || board.isDeleted) {
        return res.status(404).json({
          message: 'Không tìm thấy board với boardId đã cho',
          status: 404,
        });
      }
      // Kiểm tra xem board có thuộc về workspace hay không
      if (board.workspaceId.toString() !== workspace._id.toString()) {
        return res.status(400).json({
          message: 'Board không thuộc về workspace đã cho',
          status: 400,
        });
      }

      // Kiểm tra xem người dùng có ở trong workspace hay không
      const isWorkspaceMember = workspace.members.some(
        (member) => member.toString() === organizer.toString()
      );

      // Nếu không phải là thành viên của workspace, và cũng không phải là người tạo workspace thì ko được tạo event
      if (
        !isWorkspaceMember &&
        workspace.creator.toString() !== organizer.toString()
      ) {
        return res.status(403).json({
          message: 'Bạn không có quyền tạo sự kiện trong workspace này',
          status: 403,
        });
      }

      //Kiểm tra nếu người dùng chưa được join vào board thì không được tạo event
      const boardMembership = await BoardMembership.findOne({
        boardId: board._id,
        userId: organizer,
      });

      if (!boardMembership) {
        return res.status(403).json({
          message: 'Bạn chưa được tham gia board này',
          status: 403,
        });
      }

      //Kiểm tra participant, những người khác, không phải organizer, có trong boardMembership hay không
      if (participants && participants.length > 0) {
        for (const participant of participants) {
          const member = await BoardMembership.findOne({
            boardId: board._id,
            userId: participant.userId,
            invitationResponse: 'accepted', //Chỉ khi người dùng đã chấp nhận lời mời mới được xem là thành viên
          });
          if (!member) {
            return res.status(403).json({
              message: `Người dùng ${participant.userId} không phải là thành viên của board này`,
              status: 403,
            });
          }
        }
      }
    }
    // Kiểm tra type hợp lệ
    if (!['online', 'offline'].includes(type)) {
      return res.status(400).json({
        message: 'Loại sự kiện không hợp lệ. Phải là "online" hoặc "offline"',
        status: 400,
      });
    } else if (type === 'online' && !onlineUrl) {
      return res.status(400).json({
        message: 'Thiếu onlineUrl cho sự kiện trực tuyến',
        status: 400,
      });
    } else if (type === 'offline' && !address) {
      return res.status(400).json({
        message: 'Thiếu địa chỉ cho sự kiện offline',
        status: 400,
      });
    }

    // Kiểm tra thời gian bắt đầu và kết thúc
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        message: 'Thời gian bắt đầu phải trước thời gian kết thúc',
        status: 400,
      });
    }
    // Kiểm tra định dạng tọa độ (nếu có)
    if (address && address.coordinates) {
      if (
        !Array.isArray(address.coordinates) ||
        address.coordinates.length !== 2 ||
        typeof address.coordinates[0] !== 'number' ||
        typeof address.coordinates[1] !== 'number'
      ) {
        return res.status(400).json({
          message: 'Tọa độ phải là một mảng [longitude, latitude]',
          status: 400,
        });
      }
      // Kiểm tra xem tọa độ có hợp lệ không
      if (
        address.coordinates[0] < -180 ||
        address.coordinates[0] > 180 ||
        address.coordinates[1] < -90 ||
        address.coordinates[1] > 90
      ) {
        return res.status(400).json({
          message: 'Tọa độ không hợp lệ',
          status: 400,
        });
      }
    }

    // Kiểm tra trạng thái
    if (
      status &&
      !['draft', 'scheduled', 'completed', 'cancelled'].includes(status)
    ) {
      return res.status(400).json({
        message:
          'Trạng thái không hợp lệ. Phải là "draft", "scheduled", "completed" hoặc "cancelled"',
        status: 400,
      });
    }
    // Kiểm tra loại sự kiện
    if (
      category &&
      !['workshop', 'meeting', 'party', 'other'].includes(category)
    ) {
      return res.status(400).json({
        message:
          'Loại sự kiện không hợp lệ. Phải là "workshop", "meeting", "party" hoặc "other"',
        status: 400,
      });
    }

    // Tạo sự kiện mới
    const newEvent = new Event({
      title,
      description,
      calendarId,
      locationName,
      address,
      type,
      onlineUrl,
      meetingCode,
      startDate,
      endDate,
      recurrence,
      timeZone: timeZone || 'Asia/Ho_Chi_Minh',
      workspaceId,
      boardId,
      organizer,
      participants: participants || [],
      reminderSettings: reminderSettings || [{ method: 'popup', minutes: 15 }],
      status: status || 'scheduled',
      category: category || 'other',
      color: color || '#378006',
      allDay: allDay || false,
    });
    // example for startDate and endDate to insert to postman, with timezone Asia/Ho_Chi_Minh

    // Lưu sự kiện vào cơ sở dữ liệu
    const savedEvent = await newEvent.save();

    // Ghi lịch sử sự kiện
    await EventHistory.create({
      eventId: newEvent._id,
      participants: newEvent.participants.map((p) => p.userId),
    });

    // Tạo thông báo cho người tham gia // Hoặc gửi email

    //Convert event result with timezone Asia/Ho_Chi_Minh
    const formattedStartDate = formatDateToTimeZone(
      savedEvent.startDate,
      savedEvent.timeZone
    );
    const formattedEndDate = formatDateToTimeZone(
      savedEvent.endDate,
      savedEvent.timeZone
    );
    const createdAt = formatDateToTimeZone(
      savedEvent.createdAt,
      savedEvent.timeZone
    );
    const updatedAt = formatDateToTimeZone(
      savedEvent.updatedAt,
      savedEvent.timeZone
    );

    const newEventResult = {
      ...savedEvent.toObject(),
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      createdAt,
      updatedAt,
    };

    res.status(201).json({
      message: 'Tạo sự kiện thành công',
      status: 201,
      data: newEventResult,
    });
  } catch (error) {
    console.error('Lỗi khi tạo sự kiện:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate('participants.userId')
      .populate('calendarId')
      .select('-isDeleted -deletedAt');

    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'Lấy thông tin sự kiện thành công',
      status: 200,
      data: event,
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin sự kiện:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const { calendarId, startDate, endDate, status, category } = req.query;

    if (!calendarId) {
      return res.status(400).json({
        message: 'Thiếu calendarId',
        status: 400,
      });
    }

    const query = { calendarId, isDeleted: false };
    if (startDate && endDate) {
      query.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (status) {
      query.status = status;
    }
    if (category) {
      query.category = category;
    }

    const events = await Event.find(query).populate('participants.userId');

    // Chuyển đổi dữ liệu cho FullCalendar
    const fullCalendarEvents = events.map((event) => ({
      id: event._id.toString(),
      title: event.title,
      start: event.startDate,
      end: event.endDate,
      allDay: event.allDay || false,
      backgroundColor: event.color,
      rrule: event.recurrence ? convertToRRule(event.recurrence) : undefined,
      extendedProps: {
        description: event.description,
        locationName: event.locationName,
        type: event.type,
        organizer: event.organizer,
      },
    }));

    res.status(200).json({
      message: 'Lấy danh sách sự kiện thành công',
      status: 200,
      data: fullCalendarEvents,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sự kiện:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Ngăn cập nhật isDeleted và deletedAt
    delete updates.isDeleted;
    delete updates.deletedAt;

    const event = await Event.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).select('-isDeleted -deletedAt');

    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    // Ghi lịch sử sự kiện
    await EventHistory.create({
      eventId: id,
      participants: event.participants.map((p) => p.userId),
    });

    // Thông báo cập nhật
    if (event.participants && event.participants.length > 0) {
      const notifications = event.participants.map((participant) => ({
        userId: participant.userId,
        type: 'event_update',
        notificationType: 'system',
        content: `Sự kiện "${event.title}" đã được cập nhật`,
        eventId: event._id,
      }));
      await Notification.insertMany(notifications);
    }

    res.status(200).json({
      message: 'Cập nhật sự kiện thành công',
      status: 200,
      data: event,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật sự kiện:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'Xóa sự kiện thành công',
      status: 200,
    });
  } catch (error) {
    console.error('Lỗi khi xóa sự kiện:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, status } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: 'Thiếu userId',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    if (event.participants.some((p) => p.userId.toString() === userId)) {
      return res.status(400).json({
        message: 'Người dùng đã là người tham gia',
        status: 400,
      });
    }

    event.participants.push({ userId, status: status || 'pending' });
    await event.save();

    await Notification.create({
      userId,
      type: 'event_invite',
      notificationType: 'system',
      content: `Bạn đã được mời tham gia sự kiện: ${event.title}`,
      eventId: event._id,
    });

    res.status(200).json({
      message: 'Thêm người tham gia thành công',
      status: 200,
      data: event,
    });
  } catch (error) {
    console.error('Lỗi khi thêm người tham gia:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.updateParticipantStatus = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        message:
          'Trạng thái không hợp lệ. Phải là "pending", "accepted" hoặc "declined"',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    const participant = event.participants.find(
      (p) => p.userId.toString() === userId
    );
    if (!participant) {
      return res.status(404).json({
        message: 'Không tìm thấy người tham gia',
        status: 404,
      });
    }

    participant.status = status;
    await event.save();

    await Notification.create({
      userId,
      type: 'event_update',
      notificationType: 'system',
      content: `Trạng thái tham gia của bạn cho sự kiện "${event.title}" đã được cập nhật thành ${status}`,
      eventId: event._id,
    });

    res.status(200).json({
      message: 'Cập nhật trạng thái người tham gia thành công',
      status: 200,
      data: event,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái người tham gia:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.removeParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    event.participants = event.participants.filter(
      (p) => p.userId.toString() !== userId
    );
    await event.save();

    await Notification.create({
      userId,
      type: 'event_update',
      notificationType: 'system',
      content: `Bạn đã bị xóa khỏi sự kiện: ${event.title}`,
      eventId: event._id,
    });

    res.status(200).json({
      message: 'Xóa người tham gia thành công',
      status: 200,
      data: event,
    });
  } catch (error) {
    console.error('Lỗi khi xóa người tham gia:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getEventHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await EventHistory.find({ eventId: id }).populate(
      'participants'
    );

    res.status(200).json({
      message: 'Lấy lịch sử sự kiện thành công',
      status: 200,
      data: history,
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử sự kiện:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.sendEventReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id).populate('participants.userId');
    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    for (const reminder of event.reminderSettings) {
      if (reminder.method === 'email') {
        const recipients = event.participants.map((p) => ({
          userId: p.userId._id,
          email: p.userId.email,
          status: 'pending',
        }));

        const email = await Email.create({
          sender: {
            email: 'no-reply@web-plan-pro.com',
            name: 'Ứng dụng web quản lý kế hoạch',
          },
          recipients,
          subject: `Lời nhắc: ${event.title}`,
          body: {
            text: `Lời nhắc cho sự kiện "${event.title}" vào ${event.startDate}`,
            html: `<p>Lời nhắc cho sự kiện <strong>${event.title}</strong> vào ${event.startDate}</p>`,
          },
          eventId: event._id,
        });

        await sendMail({
          email: recipients.map((r) => r.email),
          subject: email.subject,
          html: email.body.html,
        });
      } else if (reminder.method === 'popup') {
        const notifications = event.participants.map((p) => ({
          userId: p.userId._id,
          type: 'event_reminder',
          notificationType: 'system',
          content: `Lời nhắc: Sự kiện "${event.title}" sắp bắt đầu`,
          eventId: event._id,
        }));
        await Notification.insertMany(notifications);
      }
    }

    res.status(200).json({
      message: 'Gửi lời nhắc thành công',
      status: 200,
    });
  } catch (error) {
    console.error('Lỗi khi gửi lời nhắc:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.createRecurringEvents = async (req, res) => {
  try {
    const {
      title,
      description,
      calendarId,
      locationName,
      address,
      type,
      onlineUrl,
      meetingCode,
      startDate,
      endDate,
      recurrence,
      timeZone,
      workspaceId,
      boardId,
      organizer,
      participants,
      reminderSettings,
      status,
      category,
      color,
      allDay,
    } = req.body;

    if (
      !title ||
      !calendarId ||
      !startDate ||
      !endDate ||
      !organizer ||
      !type ||
      !recurrence
    ) {
      return res.status(400).json({
        message:
          'Thiếu các trường bắt buộc: title, calendarId, startDate, endDate, organizer, type hoặc recurrence',
        status: 400,
      });
    }

    if (
      !['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(
        recurrence.type
      )
    ) {
      return res.status(400).json({
        message: 'Loại lặp lại không hợp lệ',
        status: 400,
      });
    }

    const events = [];
    let currentDate = new Date(startDate);
    const recurrenceEndDate = recurrence.endDate
      ? new Date(recurrence.endDate)
      : null;
    const interval = recurrence.interval || 1;

    while (!recurrenceEndDate || currentDate <= recurrenceEndDate) {
      const newEvent = await Event.create({
        title,
        description,
        calendarId,
        locationName,
        address,
        type,
        onlineUrl,
        meetingCode,
        startDate: new Date(currentDate),
        endDate: new Date(
          new Date(currentDate).setHours(new Date(endDate).getHours())
        ),
        recurrence,
        timeZone: timeZone || 'Asia/Ho_Chi_Minh',
        workspaceId,
        boardId,
        organizer,
        participants: participants || [],
        reminderSettings: reminderSettings || [
          { method: 'popup', minutes: 15 },
        ],
        status: status || 'scheduled',
        category: category || 'other',
        color: color || '#378006',
        allDay: allDay || false,
      });

      events.push(newEvent);
      await Calendar.findByIdAndUpdate(calendarId, {
        $push: { events: newEvent._id },
      });

      if (recurrence.type === 'daily') {
        currentDate.setDate(currentDate.getDate() + interval);
      } else if (recurrence.type === 'weekly') {
        currentDate.setDate(currentDate.getDate() + interval * 7);
      } else if (recurrence.type === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + interval);
      } else if (recurrence.type === 'yearly') {
        currentDate.setFullYear(currentDate.getFullYear() + interval);
      } else if (recurrence.type === 'custom') {
        break; // Cần logic tùy chỉnh
      }
    }

    if (participants && participants.length > 0) {
      const notifications = events.flatMap((event) =>
        participants.map((participant) => ({
          userId: participant.userId,
          type: 'event_invite',
          notificationType: 'system',
          content: `Bạn đã được mời tham gia sự kiện lặp lại: ${title}`,
          eventId: event._id,
        }))
      );
      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      message: 'Tạo sự kiện lặp lại thành công',
      status: 201,
      data: events,
    });
  } catch (error) {
    console.error('Lỗi khi tạo sự kiện lặp lại:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.addFileToEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, type, size, uploadedBy } = req.body;

    if (!name || !url || !type || !size || !uploadedBy) {
      return res.status(400).json({
        message:
          'Thiếu các trường bắt buộc: name, url, type, size hoặc uploadedBy',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    const newFile = await File.create({
      name,
      url,
      type,
      size,
      uploadedBy,
      eventId: id,
    });

    await Notification.create({
      userId: uploadedBy,
      type: 'file_shared',
      notificationType: 'system',
      content: `Tệp "${name}" đã được chia sẻ trong sự kiện: ${event.title}`,
      eventId: id,
    });

    res.status(201).json({
      message: 'Thêm tệp đính kèm thành công',
      status: 201,
      data: newFile,
    });
  } catch (error) {
    console.error('Lỗi khi thêm tệp đính kèm:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getEventFiles = async (req, res) => {
  try {
    const { id } = req.params;

    const files = await File.find({ eventId: id, isDeleted: false }).populate(
      'uploadedBy'
    );

    res.status(200).json({
      message: 'Lấy danh sách tệp đính kèm thành công',
      status: 200,
      data: files,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tệp:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.deleteEventFile = async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const file = await File.findByIdAndUpdate(
      fileId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!file) {
      return res.status(404).json({
        message: 'Không tìm thấy tệp',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'Xóa tệp đính kèm thành công',
      status: 200,
    });
  } catch (error) {
    console.error('Lỗi khi xóa tệp:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.addMessageToEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, content, parentMessage } = req.body;

    if (!userId || !content) {
      return res.status(400).json({
        message: 'Thiếu userId hoặc content',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    const newMessage = await Message.create({
      eventId: id,
      userId,
      content,
      parentMessage,
    });

    await Notification.create({
      userId,
      type: 'message',
      notificationType: 'system',
      content: `Bình luận mới trong sự kiện: ${event.title}`,
      eventId: id,
      messageId: newMessage._id,
    });

    res.status(201).json({
      message: 'Thêm bình luận thành công',
      status: 201,
      data: newMessage,
    });
  } catch (error) {
    console.error('Lỗi khi thêm bình luận:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getEventMessages = async (req, res) => {
  try {
    const { id } = req.params;

    const messages = await Message.find({
      eventId: id,
      isDeleted: false,
    }).populate('userId');

    res.status(200).json({
      message: 'Lấy danh sách bình luận thành công',
      status: 200,
      data: messages,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bình luận:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.deleteEventMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;

    const message = await Message.findByIdAndUpdate(
      messageId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        message: 'Không tìm thấy bình luận',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'Xóa bình luận thành công',
      status: 200,
    });
  } catch (error) {
    console.error('Lỗi khi xóa bình luận:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

// Hàm chuyển đổi recurrence sang RRule
function convertToRRule(recurrence) {
  if (!recurrence || !recurrence.type) return null;

  const { type, interval = 1, endDate } = recurrence;
  const freqMap = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  };

  let rrule = `FREQ=${freqMap[type]};INTERVAL=${interval}`;
  if (endDate) {
    rrule += `;UNTIL=${
      new Date(endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }`;
  }
  return rrule;
}
