const Calendar = require('../models/calendarModel');
const Event = require('../models/eventModel');
const Task = require('../models/taskModel');
const Board = require('../models/boardModel');
const mongoose = require('mongoose');

exports.createCalendar = async (req, res) => {
  try {
    const {
      name,
      description,
      ownerType,
      defaultView,
      timeZone,
      color,
      isPublic,
      boardId,
    } = req.body;
    const ownerId = req.user._id;

    // Kiểm tra các trường bắt buộc
    if (!name || !ownerType || !ownerId) {
      return res.status(400).json({
        message: 'Thiếu các trường bắt buộc: name, ownerType hoặc ownerId',
        status: 400,
      });
    }

    // Kiểm tra ownerType hợp lệ
    if (!['user', 'board'].includes(ownerType)) {
      return res.status(400).json({
        message: 'ownerType không hợp lệ. Phải là "user" hoặc "board"',
        status: 400,
      });
    }

    //Nếu là lịch cá nhân, kiểm tra và tạo nếu user chưa có
    if (ownerType === 'user') {
      //Kiểm tra lịch cá nhân có tồn tại chưa
      const personalCalendar = await Calendar.find({
        ownerId,
        isDeleted: false,
      });
      if (personalCalendar.length > 0) {
        console.log('Lịch cá nhân đã tồn tại');
        return res.status(409).json({
          message: 'Bạn đã có lịch cá nhân của mình',
          status: 409,
        });
      }

      // Tạo lịch mới
      const newCalendar = await Calendar.create({
        name,
        description,
        ownerType,
        ownerId,
        defaultView: defaultView || 'dayGridMonth',
        timeZone: timeZone || 'Asia/Ho_Chi_Minh',
        color: color || '#378006',
        isPublic: isPublic || false,
      });

      return res.status(201).json({
        message: 'Tạo lịch cá nhân thành công',
        status: 201,
        data: newCalendar,
      });
    } else if (ownerType === 'board') {
      //Kiểm tra lịch board hiện tại đã có tồn tại calendar nào đi kèm hay chưa
      const boardCalendar = await Calendar.find({
        ownerId: boardId,
        isDeleted: false,
      });

      if (boardCalendar.length > 0) {
        console.log('Lịch của board đã tồn tại');
        return res.status(409).json({
          message: 'Board này đã có lịch được tạo trước đó',
          status: 409,
        });
      }

      // Tạo lịch mới
      const newCalendar = await Calendar.create({
        name,
        description,
        ownerType,
        ownerId: boardId,
        defaultView: defaultView || 'dayGridMonth',
        timeZone: timeZone || 'Asia/Ho_Chi_Minh',
        color: color || '#378006',
        isPublic: isPublic || false,
      });

      return res.status(201).json({
        message: 'Tạo lịch cá nhân thành công',
        status: 201,
        data: newCalendar,
      });
    }

    // // Tạo lịch mới
    // const newCalendar = await Calendar.create({
    //   name,
    //   description,
    //   ownerType,
    //   ownerId,
    //   defaultView: defaultView || 'dayGridMonth',
    //   timeZone: timeZone || 'Asia/Ho_Chi_Minh',
    //   color: color || '#378006',
    //   isPublic: isPublic || false,
    // });

    // return res.status(201).json({
    //   message: 'Tạo lịch thành công',
    //   status: 201,
    //   data: newCalendar,
    // });
  } catch (error) {
    console.error('Lỗi khi tạo lịch:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getCalendarById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('id getcalendarbyid', id);

    const calendar = await Calendar.findById(id)
      .populate('events')
      .populate('tasks')
      .select('-isDeleted -deletedAt');

    if (!calendar) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch',
        status: 404,
      });
    }

    return res.status(200).json({
      message: 'Lấy thông tin lịch thành công',
      status: 200,
      data: calendar,
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin lịch:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getCalendarByUserId = async (req, res) => {
  try {
    const userId = req.user._id;

    const calendars = await Calendar.find({
      ownerId: userId,
      ownerType: 'user',
      isDeleted: false,
    })
      .populate('events')
      .populate('tasks')
      .select('-isDeleted -deletedAt');

    if (!calendars.length) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch cho người dùng này',
        status: 404,
      });
    }

    return res.status(200).json({
      message: 'Lấy danh sách lịch thành công',
      status: 200,
      data: calendars,
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin lịch của người dùng:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getCalendarByBoardId = async (req, res) => {
  try {
    const { boardId } = req.params;

    const calendars = await Calendar.find({
      ownerId: boardId,
      ownerType: 'board',
      isDeleted: false,
    })
      .populate('events')
      .populate('tasks')
      .select('-isDeleted -deletedAt');

    if (!calendars.length) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch cho board này',
        status: 404,
      });
    }

    return res.status(200).json({
      message: 'Lấy danh sách lịch board thành công',
      status: 200,
      data: calendars,
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin lịch của board:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getAllCalendarsUserOrGroup = async (req, res) => {
  try {
    const { ownerType } = req.body;
    const ownerId = req.user._id;

    if (!ownerType || !ownerId) {
      return res.status(400).json({
        message: 'Thiếu ownerType hoặc ownerId',
        status: 400,
      });
    }

    const calendars = await Calendar.find({
      ownerType,
      ownerId,
      isDeleted: false,
    })
      .populate('events')
      .populate('tasks')
      .select('-isDeleted -deletedAt');

    return res.status(200).json({
      message: 'Lấy danh sách lịch thành công',
      status: 200,
      data: calendars,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lịch:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.updateCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      events,
      tasks,
      defaultView,
      timeZone,
      isPublic,
    } = req.body;

    //Find calendar by ID
    const calendar = await Calendar.findById(id).select(
      '-isDeleted -deletedAt'
    );
    if (!calendar) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch',
        status: 404,
      });
    }
    //Check if the user is the owner of the calendar
    const ownerId = req.user._id;
    if (calendar.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({
        message: 'Bạn không có quyền sửa đổi lịch này',
        status: 403,
      });
    }
    // Cập nhật các trường của lịch
    calendar.name = name || calendar.name;
    calendar.description = description || calendar.description;
    calendar.events = events || calendar.events;
    calendar.tasks = tasks || calendar.tasks;
    calendar.defaultView = defaultView || calendar.defaultView;
    calendar.timeZone = timeZone || calendar.timeZone;
    calendar.isPublic = isPublic !== undefined ? isPublic : calendar.isPublic;
    calendar.color = req.body.color || calendar.color; // Cập nhật màu sắc nếu có
    // Lưu lịch đã cập nhật
    await calendar.save();

    return res.status(200).json({
      message: 'Cập nhật lịch thành công',
      status: 200,
      data: calendar,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.deleteCalendar = async (req, res) => {
  try {
    const { id } = req.params;

    const calendar = await Calendar.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!calendar) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch',
        status: 404,
      });
    }

    return res.status(200).json({
      message: 'Xóa lịch thành công',
      status: 200,
    });
  } catch (error) {
    console.error('Lỗi khi xóa lịch:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getCalendarEvents = async (req, res) => {
  try {
    const { id } = req.params; // calendarId
    const { startDate, endDate, status, participantId, type } = req.query;

    // Validate calendar existence
    const calendar = await Calendar.findById(id).select(
      '-isDeleted -deletedAt'
    );
    if (!calendar) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch',
        status: 404,
      });
    }

    // Build query
    const query = {
      calendarId: id,
      isDeleted: false,
    };

    // Required date range filter for FullCalendar
    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      return res.status(400).json({
        message: 'Thiếu ngày bắt đầu hoặc ngày kết thúc',
        status: 400,
      });
    }

    // Optional filters
    if (
      status &&
      ['draft', 'scheduled', 'completed', 'cancelled'].includes(status)
    ) {
      query.status = status;
    }

    if (type && ['online', 'offline'].includes(type)) {
      query.type = type;
    }

    if (participantId) {
      query['participants.userId'] = participantId;
    }

    // Fetch events
    const events = await Event.find(query)
      .populate('participants.userId', 'name email username')
      .populate('organizer', 'username email name')
      .populate('calendarId', 'name color')
      .populate('workspaceId', 'name')
      .populate('boardId', 'name')
      .select('-isDeleted -deletedAt');

    events.forEach((event) => {
      event.participants.forEach((e) => {
        console.log(
          'e.participants in getCalendarEvents in calendarController',
          e
        );
      });
    });

    // Format for FullCalendar
    const fullCalendarEvents = events.map((event) => ({
      id: event._id.toString(),
      title: event.title,
      start: event.startDate,
      end: event.endDate,
      allDay: event.allDay || false,
      backgroundColor: event.color || calendar.color,
      borderColor: event.color || calendar.color,
      textColor: '#ffffff',
      extendedProps: {
        description: event.description,
        locationName: event.locationName,
        address: event.address,
        type: event.type,
        onlineUrl: event.onlineUrl,
        meetingCode: event.meetingCode,
        timeZone: event.timeZone,
        organizer: {
          userId: event.organizer._id,
          username: event.organizer.username || event.organizer.name,
          email: event.organizer.email,
        },
        participants: event.participants.map((p) => ({
          userId: p.userId?._id || p.userId?.id,
          name: p.userId?.name || p.userId?.username,
          email: p.userId?.email,
          status: p.status,
        })),
        calendar: {
          id: event.calendarId._id,
          name: event.calendarId.name,
          color: event.calendarId.color,
        },
        workspace: event.workspaceId
          ? { id: event.workspaceId._id, name: event.workspaceId.name }
          : null,
        board: event.boardId
          ? { id: event.boardId._id, name: event.boardId.name }
          : null,
        status: event.status,
        category: event.category,
        isOwn: true,
        rrule: event.recurrence ? convertToRRule(event.recurrence) : undefined,
      },
    }));

    return res.status(200).json({
      message: `Lấy danh sách sự kiện từ lịch ${id} thành công`,
      status: 200,
      data: fullCalendarEvents,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sự kiện:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

function convertToRRule(recurrence) {
  if (!recurrence || !recurrence.type) return null;

  const { type, interval = 1, endDate } = recurrence;
  const freqMap = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
    custom: 'CUSTOM',
  };

  let rrule = `FREQ=${freqMap[type]};INTERVAL=${interval}`;
  if (endDate) {
    rrule += `;UNTIL=${
      new Date(endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }`;
  }
  return rrule;
}
