const Calendar = require('../models/calendarModel');
const Event = require('../models/eventModel');
const Task = require('../models/taskModel');

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
    if (!['user', 'workspace'].includes(ownerType)) {
      return res.status(400).json({
        message: 'ownerType không hợp lệ. Phải là "user" hoặc "workspace"',
        status: 400,
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

    res.status(201).json({
      message: 'Tạo lịch thành công',
      status: 201,
      data: newCalendar,
    });
  } catch (error) {
    console.error('Lỗi khi tạo lịch:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getCalendarById = async (req, res) => {
  try {
    const { id } = req.params;

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

    res.status(200).json({
      message: 'Lấy thông tin lịch thành công',
      status: 200,
      data: calendar,
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin lịch:', error);
    res.status(500).json({
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

    res.status(200).json({
      message: 'Lấy danh sách lịch thành công',
      status: 200,
      data: calendars,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lịch:', error);
    res.status(500).json({
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

    res.status(200).json({
      message: 'Cập nhật lịch thành công',
      status: 200,
      data: calendar,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch:', error);
    res.status(500).json({
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

    res.status(200).json({
      message: 'Xóa lịch thành công',
      status: 200,
    });
  } catch (error) {
    console.error('Lỗi khi xóa lịch:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

exports.getCalendarEvents = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, status } = req.query;

    const query = { calendarId: id, isDeleted: false };
    if (startDate && endDate) {
      query.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (status) {
      query.status = status;
    }

    const events = await Event.find(query).populate('participants.userId');

    // Chuyển đổi dữ liệu cho FullCalendar
    const fullCalendarEvents = events.map((event) => ({
      id: event._id.toString(),
      title: event.title,
      start: event.startDate,
      end: event.endDate,
      allDay: event.allDay || false, // Giả sử allDay sẽ được thêm vào Event
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

exports.getCalendarTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const { deadline, assignedTo } = req.query;

    const query = { calendarId: id, isDeleted: false };
    if (deadline) {
      query.deadline = { $lte: new Date(deadline) };
    }
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    const tasks = await Task.find(query).populate('assignedTo assignedBy');

    res.status(200).json({
      message: 'Lấy danh sách nhiệm vụ thành công',
      status: 200,
      data: tasks,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhiệm vụ:', error);
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
