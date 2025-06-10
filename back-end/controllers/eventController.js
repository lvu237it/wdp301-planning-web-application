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
const User = require('../models/userModel');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const { createMeetSpace } = require('./meetController');

const MEET_SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];

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
            // invitationResponse: 'accepted', //Chỉ khi người dùng đã chấp nhận lời mời mới được xem là thành viên
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

    if (type === 'online') {
      const meetUrl = await createMeetSpace(req, MEET_SCOPES); // Truyền scope Meet
      if (!meetUrl) throw new AppError('Không thể tạo link Meet', 500);
      newEvent.onlineUrl = meetUrl;
      console.log('Meeting created', meetUrl);
    }

    // Lưu sự kiện vào cơ sở dữ liệu
    const savedEvent = await newEvent.save();

    // Ghi lịch sử sự kiện, kèm theo cả status của mỗi người tham gia
    await EventHistory.create({
      eventId: savedEvent._id,
      action: 'create_event',
      participants: savedEvent.participants.map((p) => ({
        userId: p.userId,
        status: p.status,
      })),
    });

    // Gửi thông báo đã tạo sự kiện, cho những người đã tham gia board

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
    if (!id) {
      return res.status(400).json({
        message: 'Thiếu id sự kiện',
        status: 400,
      });
    }
    const event = await Event.findById(id)
      .populate('participants.userId', 'name email')
      .populate('calendarId', 'name color')
      .populate('workspaceId', 'name');
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    const organizerFound = await User.findById(event.organizer, 'name email');

    // Chuyển đổi dữ liệu cho FullCalendar
    const fullCalendarEvent = {
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
        address: event.address,
        type: event.type,
        onlineUrl: event.onlineUrl,
        meetingCode: event.meetingCode,
        organizer: {
          userId: event.organizer._id,
          name: organizerFound.name,
          email: organizerFound.email,
        },
        participants: event.participants.map((p) => ({
          userId: p.userId._id,
          name: p.userId.name,
          email: p.userId.email,
          status: p.status,
        })),
        calendar: {
          id: event.calendarId._id,
          name: event.calendarId.name,
          color: event.calendarId.color,
        },
        workspace: event.workspaceId
          ? {
              id: event.workspaceId._id,
              name: event.workspaceId.name,
            }
          : null,
        board: event.boardId
          ? {
              id: event.boardId._id,
              name: event.boardId.name,
            }
          : null,
      },
    };

    res.status(200).json({
      message: 'Lấy thông tin sự kiện thành công',
      status: 200,
      data: fullCalendarEvent,
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
    const userId = req.user._id; // Lấy ID người dùng từ token đã xác thực
    const events = await Event.find({
      'participants.userId': userId,
      isDeleted: false,
      // 'participants.status': { $ne: 'declined' }, // Lọc những sự kiện mà người dùng đã không từ chối
    })
      .populate('participants.userId', 'name email') // Chỉ lấy name và email của người tham gia
      .populate('calendarId', 'name color') // Chỉ lấy name và color của lịch
      .populate('workspaceId', 'name') // Chỉ lấy name của workspace
      .populate('boardId', 'name'); // Chỉ lấy name của board
    // Chuyển đổi dữ liệu cho FullCalendar
    const fullCalendarEvents = events.map((event) => {
      const organizerFound = event.participants.find(
        (p) => p.userId._id.toString() === event.organizer.toString()
      );
      return {
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
          address: event.address,
          type: event.type,
          onlineUrl: event.onlineUrl,
          meetingCode: event.meetingCode,
          organizer: {
            userId: event.organizer._id,
            name: organizerFound.userId.name,
            email: organizerFound.userId.email,
          },
          participants: event.participants.map((p) => ({
            userId: p.userId._id,
            name: p.userId.name,
            email: p.userId.email,
            status: p.status,
          })),
          calendar: {
            id: event.calendarId._id,
            name: event.calendarId.name,
            color: event.calendarId.color,
          },
          workspace: event.workspaceId
            ? {
                id: event.workspaceId._id,
                name: event.workspaceId.name,
              }
            : null,
          board: event.boardId
            ? {
                id: event.boardId._id,
                name: event.boardId.name,
              }
            : null,
        },
      };
    });
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
      allDay,
      recurrence,
      reminderSettings,
      status,
      category,
      color,
    } = req.body;

    //Cho phép cập nhật 1 số trường có thể thay đổi nhiều, không bao gồm participants, organizer, calendarId, workspaceId, boardId
    if (!id) {
      return res.status(400).json({
        message: 'Thiếu id sự kiện',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    //Kiểm tra xem người đăng nhập có phải là người tạo event không, nếu không thì không thể cập nhật
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Bạn không có quyền cập nhật sự kiện này',
        status: 403,
      });
    }
    console.log('type onlineofline', type);
    //Nếu sự kiện online thì có thể cập nhật onlineUrl hoặc meetingCode
    if (type === 'online') {
      if (!onlineUrl && !meetingCode) {
        return res.status(400).json({
          message: 'Thiếu onlineUrl hoặc meetingCode cho sự kiện trực tuyến',
          status: 400,
        });
      }
      event.type = 'online'; // Đặt type là online
      if (onlineUrl) {
        event.onlineUrl = onlineUrl;
      }
      if (meetingCode) {
        event.meetingCode = meetingCode;
      }
      event.address = null; // Đặt address là null nếu là sự kiện online
      event.locationName = null; // Đặt locationName là null nếu là sự kiện online
    } else if (type === 'offline') {
      //Nếu sự kiện offline thì có thể cập nhật address, locationName
      if (!address || !locationName) {
        return res.status(400).json({
          message: 'Thiếu address hoặc locationName cho sự kiện offline',
          status: 400,
        });
      }
      event.type = 'offline'; // Đặt type là offline
      event.address = address;
      event.locationName = locationName;
      event.onlineUrl = null; // Đặt onlineUrl là null nếu là sự kiện offline
    } else {
      return res.status(400).json({
        message: 'Loại sự kiện không hợp lệ. Phải là "online" hoặc "offline"',
        status: 400,
      });
    }

    if (startDate && endDate) {
      // Kiểm tra thời gian bắt đầu và kết thúc
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        return res.status(400).json({
          message: 'Thời gian bắt đầu phải trước thời gian kết thúc',
          status: 400,
        });
      }

      event.startDate = start || event.startDate;
      event.endDate = end || event.endDate;
    }
    // Cập nhật các trường khác
    event.title = title || event.title;
    event.description = description || event.description;
    event.allDay = allDay || event.allDay;
    event.recurrence = recurrence || event.recurrence;
    event.reminderSettings = reminderSettings || event.reminderSettings;
    event.status = status || event.status;
    event.category = category || event.category;
    event.color = color || event.color;
    event.timeZone = req.body.timeZone || event.timeZone || 'Asia/Ho_Chi_Minh';

    const updatedEvent = await event.save();

    // Gửi thông báo cho những người đã tham gia trong sự kiện (chỉ những người là participants - đã accepted)

    res.status(200).json({
      message: 'Cập nhật sự kiện thành công',
      status: 200,
      data: updatedEvent,
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

    if (!id) {
      return res.status(400).json({
        message: 'Thiếu id sự kiện',
        status: 400,
      });
    }
    const event = await Event.findById(id);
    if (event.isDeleted) {
      return res.status(400).json({
        message: 'Sự kiện đã bị xóa trước đó',
        status: 400,
      });
    }
    // Kiểm tra xem người dùng có phải là người tạo sự kiện không
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Bạn không có quyền xóa sự kiện này',
        status: 403,
      });
    }

    // Đánh dấu sự kiện là đã xóa
    event.isDeleted = true;
    event.deletedAt = new Date();
    await event.save();

    // Ghi lịch sử sự kiện, kèm theo cả status của mỗi người tham gia
    await EventHistory.create({
      eventId: event._id,
      action: 'delete_event',
      participants: event.participants.map((p) => ({
        userId: p.userId,
        status: p.status,
      })),
      isDeleted: true,
      deletedAt: new Date(),
    });

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

exports.inviteToBecomeParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    //mời người tham gia sự kiện theo email
    const { email } = req.body;
    console.log('id', id);
    console.log('email', email);

    //Kiểm tra sự kiện còn tồn tại không
    if (!id) {
      return res.status(400).json({
        message: 'Thiếu id sự kiện',
        status: 400,
      });
    }

    //Kiểm tra người được mời có tồn tại và có trong boardMembership hay không
    if (!email) {
      return res.status(400).json({
        message: 'Thiếu email người được mời',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    const invitedUser = await User.findOne({
      email: email,
      isDeleted: false,
    });

    if (!invitedUser) {
      return res.status(404).json({
        message: 'Không tìm thấy người dùng với email này',
        status: 404,
      });
    }
    console.log('event', event);
    //Kiểm tra xem người dùng có đang mời chính mình vào sự kiện không
    if (event.organizer.toString() === invitedUser._id.toString()) {
      return res.status(400).json({
        message: 'Bạn không thể mời chính mình vào sự kiện',
        status: 400,
      });
    }

    //Kiểm tra invitedUser có trong boardMembership hay không
    const boardMembership = await BoardMembership.findOne({
      boardId: event.boardId,
      userId: invitedUser._id,
    });

    console.log('boardMembership', boardMembership);
    if (!boardMembership) {
      return res.status(403).json({
        message: 'Người dùng không phải là thành viên của board này',
        status: 403,
      });
    }

    // Kiểm tra xem người dùng đã là người tham gia sự kiện chưa
    const existingParticipant = event.participants.find(
      (p) => p.userId.toString() === invitedUser._id.toString()
    );
    if (
      existingParticipant &&
      boardMembership.invitationResponse === 'accepted'
    ) {
      return res.status(400).json({
        message: 'Người dùng đã là người tham gia sự kiện này',
        status: 400,
      });
    } else if (
      existingParticipant &&
      boardMembership.invitationResponse === 'pending'
    ) {
      return res.status(400).json({
        message:
          'Người dùng đã được mời tham gia sự kiện này và đang chờ phản hồi',
        status: 400,
      });
    } else {
      // Kiểm tra xem người dùng có phải là người tạo sự kiện không
      if (event.organizer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: 'Bạn không có quyền thêm người tham gia vào sự kiện này',
          status: 403,
        });
      }

      // Mời người dùng vào danh sách người tham gia sự kiện
      event.participants.push({
        userId: invitedUser._id,
        status: 'pending', // Trạng thái ban đầu là pending
      });
      await event.save();

      await EventHistory.create({
        eventId: event._id,
        action: 'add_participant',
        participants: [{ userId: invitedUser._id, status: 'pending' }],
      });

      //Gửi thông báo cho người được mời tham gia sự kiện

      return res.status(200).json({
        message: 'Mời người tham gia thành công',
        status: 200,
        data: event,
      });
    }
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

    //Kiểm tra sự kiện có tồn tại không
    if (!id || !userId) {
      return res.status(400).json({
        message: 'Thiếu id sự kiện hoặc userId',
        status: 400,
      });
    }

    //Kiểm tra người cập nhật trạng thái
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Bạn không có quyền cập nhật trạng thái người tham gia',
        status: 403,
      });
    }

    //Kiểm tra status có hợp lệ không
    if (!status || !['pending', 'accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        message:
          'Trạng thái không hợp lệ. Phải là "pending", "accepted" hoặc "declined"',
        status: 400,
      });
    }

    //Kiểm tra sự kiện có tồn tại không
    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }

    //Nếu trước đó trạng thái đã là "declined" thì không thể cập nhật lại
    const existingParticipant = event.participants.find(
      (p) => p.userId.toString() === userId
    );

    // Kiểm tra xem người dùng có phải là người tham gia sự kiện không
    const participantIndex = event.participants.findIndex(
      (p) => p.userId.toString() === userId
    );
    if (participantIndex === -1) {
      return res.status(404).json({
        message: 'Người dùng không phải là người tham gia sự kiện này',
        status: 404,
      });
    }
    // Cập nhật trạng thái người tham gia
    event.participants[participantIndex].status = status;
    await event.save();

    //Ghi lịch sử sự kiện, kèm theo cả status của mỗi người tham gia
    await EventHistory.create({
      eventId: event._id,
      action: 'update_participant_status',
      participants: [
        { userId: event.participants[participantIndex].userId, status },
      ],
    });

    //Người dùng - người được mời tham gia sự kiện - thông báo chấp nhận/từ chối tham gia sự kiện tới người tạo lời mời

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

    //Kiểm tra sự kiện có tồn tại không
    if (!id || !userId) {
      return res.status(400).json({
        message: 'Thiếu id sự kiện hoặc userId',
        status: 400,
      });
    }

    //Kiểm tra người xóa có phải là người tạo sự kiện không
    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Bạn không có quyền xóa người tham gia khỏi sự kiện này',
        status: 403,
      });
    }
    // Kiểm tra xem người dùng có phải là người tham gia sự kiện không
    const participantIndex = event.participants.findIndex(
      (p) => p.userId.toString() === userId
    );
    if (participantIndex === -1) {
      return res.status(404).json({
        message: 'Người dùng không phải là người tham gia sự kiện này',
        status: 404,
      });
    }

    //Xoá người tham gia khỏi sự kiện
    const removedParticipant = event.participants[participantIndex];
    event.participants.splice(participantIndex, 1);
    await event.save();

    //Ghi lịch sử sự kiện, kèm theo cả status của mỗi người tham gia
    await EventHistory.create({
      eventId: event._id,
      action: 'remove_participant',
      participants: [
        {
          userId: removedParticipant.userId,
          status: 'rejected',
        },
      ],
    });

    res.status(200).json({
      message: 'Xóa người tham gia khỏi sự kiện thành công',
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

    if (!id) {
      return res.status(400).json({
        message: 'Thiếu id sự kiện',
        status: 400,
      });
    }
    const event = await Event.findById(id)
      .populate('organizer', 'name email') // Populate organizer để lấy name và email
      .populate('participants.userId', 'name email'); // Populate participants để kiểm tra quyền
    if (!event) {
      return res.status(404).json({
        message: 'Không tìm thấy sự kiện',
        status: 404,
      });
    }
    console.log('event.participants:', event.participants);
    console.log('req.user._id:', req.user._id); // Debug req.user._id

    const isParticipant = event.participants.some(
      (p) => p.userId.toString() === req.user._id.toString()
    );
    const isOrganizer =
      event.organizer._id.toString() === req.user._id.toString();
    if (!isParticipant && !isOrganizer) {
      return res.status(403).json({
        message: 'Bạn không có quyền xem lịch sử sự kiện này',
        status: 403,
      });
    }

    // Lấy lịch sử sự kiện từ EventHistory
    const eventHistory = await EventHistory.find({ eventId: id })
      .populate('participants.userId', 'name email') // Populate userId trong participants
      .sort({ createdAt: -1 });
    if (!eventHistory || eventHistory.length === 0) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch sử sự kiện',
        status: 404,
      });
    }

    // Chuẩn bị thông tin organizer để thêm vào participants
    const organizerInfo = {
      userId: event.organizer._id.toString(),
      email: event.organizer.email || '',
      status: 'accepted', // Organizer luôn có trạng thái accepted
      role: 'organizer', // Thêm trường role để phân biệt
    };

    // Chuyển đổi dữ liệu lịch sử sự kiện
    const formattedHistory = eventHistory.map((history) => {
      // Thêm organizer vào danh sách participants nếu không trùng userId
      const participantsWithOrganizer = history.participants
        .map((p) => ({
          userId: p.userId._id.toString(),
          email: p.userId.email || '',
          status: p.status,
          role: 'participant', // Đánh dấu role cho participants
        }))
        .filter(
          (p) => p.userId !== organizerInfo.userId // Loại bỏ organizer nếu đã có trong participants
        );

      // Thêm organizer vào đầu danh sách participants
      participantsWithOrganizer.unshift(organizerInfo);

      return {
        id: history._id.toString(),
        eventId: history.eventId.toString(),
        action: history.action,
        participants: participantsWithOrganizer,
        createdAt: history.createdAt,
        updatedAt: history.updatedAt,
        isDeleted: history.isDeleted || false,
        deletedAt: history.deletedAt || null,
      };
    });

    res.status(200).json({
      message: 'Lấy lịch sử sự kiện thành công',
      status: 200,
      data: formattedHistory,
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
