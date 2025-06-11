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
const AppError = require('../utils/appError');
const { authorize } = require('../utils/googleAuthUtils');
const { google } = require('googleapis');
const { geocodeAddress, validateCoordinates } = require('../utils/geocoding');
const NotificationService = require('../services/NotificationService');

const MEET_SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Helper function để xử lý địa chỉ và geocoding
const processAddressData = async (locationName, addressInput, type) => {
  if (type === 'online') {
    return null; // Sự kiện online không cần address
  }

  if (!locationName && !addressInput) {
    return null; // Không có thông tin địa chỉ
  }

  // Kết hợp locationName và address thành full address string
  const fullAddress = [locationName, addressInput].filter(Boolean).join(', ');

  console.log('Processing address:', fullAddress);

  // Thử geocoding
  const geocodedData = await geocodeAddress(fullAddress);

  if (geocodedData) {
    // Nếu geocoding thành công, trả về object đầy đủ
    return geocodedData;
  } else {
    // Nếu geocoding thất bại, vẫn lưu thông tin cơ bản
    console.warn('Geocoding failed, saving basic address info');
    return {
      type: 'Point',
      coordinates: null,
      formattedAddress: fullAddress,
      placeId: null,
      mapZoomLevel: 15,
    };
  }
};

// Helper function để tạo sự kiện trên Google Calendar
const createGoogleCalendarEvent = async (userId, eventData) => {
  try {
    const auth = await authorize(userId, 'calendar', CALENDAR_SCOPES);
    const calendar = google.calendar({ version: 'v3', auth });

    // Lấy email của participants từ database
    const participantEmails = [];
    if (eventData.participants && eventData.participants.length > 0) {
      for (const participant of eventData.participants) {
        try {
          const user = await User.findById(participant.userId, 'email');
          if (user && user.email) {
            participantEmails.push({ email: user.email });
          }
        } catch (error) {
          console.warn(
            'Could not find user email for participant:',
            participant.userId
          );
        }
      }
    }

    const googleEvent = {
      summary: eventData.title,
      description: eventData.description || '',
      start: {
        dateTime: eventData.allDay
          ? undefined
          : new Date(eventData.startDate).toISOString(),
        date: eventData.allDay
          ? new Date(eventData.startDate).toISOString().split('T')[0]
          : undefined,
        timeZone: eventData.timeZone || 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: eventData.allDay
          ? undefined
          : new Date(eventData.endDate).toISOString(),
        date: eventData.allDay
          ? new Date(eventData.endDate).toISOString().split('T')[0]
          : undefined,
        timeZone: eventData.timeZone || 'Asia/Ho_Chi_Minh',
      },
      location:
        eventData.type === 'offline'
          ? `${eventData.locationName || ''} ${
              eventData.address?.formattedAddress || ''
            }`.trim()
          : undefined,
      attendees: participantEmails,
    };

    // Thêm Meet link nếu là sự kiện online
    if (eventData.type === 'online' && eventData.onlineUrl) {
      googleEvent.conferenceData = {
        createRequest: {
          requestId:
            'meet-' +
            Date.now() +
            '-' +
            Math.random().toString(36).substring(2, 9),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
      googleEvent.description += `\n\nLink tham gia: ${eventData.onlineUrl}`;
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: googleEvent,
      conferenceDataVersion: eventData.type === 'online' ? 1 : 0,
    });

    console.log('Google Calendar event created:', response.data.id);
    return response.data.id; // Trả về Google event ID
  } catch (error) {
    console.error('Error creating Google Calendar event:', error.message);
    // Không throw error để không làm gián đoạn quá trình tạo event chính
    return null;
  }
};

// Helper function để cập nhật sự kiện trên Google Calendar
const updateGoogleCalendarEvent = async (userId, googleEventId, eventData) => {
  try {
    const auth = await authorize(userId, 'calendar', CALENDAR_SCOPES);
    const calendar = google.calendar({ version: 'v3', auth });

    // Lấy email của participants từ database
    const participantEmails = [];
    if (eventData.participants && eventData.participants.length > 0) {
      for (const participant of eventData.participants) {
        try {
          const user = await User.findById(participant.userId, 'email');
          if (user && user.email) {
            participantEmails.push({ email: user.email });
          }
        } catch (error) {
          console.warn(
            'Could not find user email for participant:',
            participant.userId
          );
        }
      }
    }

    const googleEvent = {
      summary: eventData.title,
      description: eventData.description || '',
      start: {
        dateTime: eventData.allDay
          ? undefined
          : new Date(eventData.startDate).toISOString(),
        date: eventData.allDay
          ? new Date(eventData.startDate).toISOString().split('T')[0]
          : undefined,
        timeZone: eventData.timeZone || 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: eventData.allDay
          ? undefined
          : new Date(eventData.endDate).toISOString(),
        date: eventData.allDay
          ? new Date(eventData.endDate).toISOString().split('T')[0]
          : undefined,
        timeZone: eventData.timeZone || 'Asia/Ho_Chi_Minh',
      },
      location:
        eventData.type === 'offline'
          ? `${eventData.locationName || ''} ${
              eventData.address?.formattedAddress || ''
            }`.trim()
          : undefined,
      attendees: participantEmails,
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: googleEvent,
    });

    console.log('Google Calendar event updated:', response.data.id);
    return true;
  } catch (error) {
    console.error('Error updating Google Calendar event:', error.message);
    return false;
  }
};

// Helper function để xóa sự kiện trên Google Calendar
const deleteGoogleCalendarEvent = async (userId, googleEventId) => {
  try {
    const auth = await authorize(userId, 'calendar', CALENDAR_SCOPES);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });

    console.log('Google Calendar event deleted:', googleEventId);
    return true;
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error.message);
    return false;
  }
};

exports.createEventForCalendar = async (req, res) => {
  try {
    const {
      title,
      description,
      locationName,
      address,
      type,
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
      participantEmails, // New field for emails
    } = req.body;
    const { calendarId } = req.params;
    const organizer = req.user._id;
    let participants = [{ userId: organizer, status: 'accepted' }];

    // Process participant emails if provided
    if (
      participantEmails &&
      Array.isArray(participantEmails) &&
      participantEmails.length > 0
    ) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = participantEmails.filter(
        (email) => !emailRegex.test(email.trim())
      );

      if (invalidEmails.length > 0) {
        return res.status(400).json({
          message: `Email không hợp lệ: ${invalidEmails.join(', ')}`,
          status: 400,
        });
      }

      // Check if user is trying to invite themselves
      const currentUserEmail = req.user.email;
      const selfInvite = participantEmails.some(
        (email) => email.trim().toLowerCase() === currentUserEmail.toLowerCase()
      );

      if (selfInvite) {
        return res.status(400).json({
          message: 'Bạn không thể mời chính mình tham gia sự kiện',
          status: 400,
        });
      }

      // Find users by emails
      const cleanEmails = participantEmails.map((email) =>
        email.trim().toLowerCase()
      );
      const users = await User.find({
        email: { $in: cleanEmails },
        isDeleted: false,
      }).select('_id email');

      const foundEmails = users.map((user) => user.email.toLowerCase());
      const notFoundEmails = cleanEmails.filter(
        (email) => !foundEmails.includes(email)
      );

      if (notFoundEmails.length > 0) {
        return res.status(400).json({
          message: `Không tìm thấy người dùng với email: ${notFoundEmails.join(
            ', '
          )}`,
          status: 400,
        });
      }

      // Add found users to participants
      const participantUsers = users.map((user) => ({
        userId: user._id,
        status: 'pending',
      }));

      participants = [...participants, ...participantUsers];
    }

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

    const calendar = await Calendar.findById(calendarId);
    if (!calendar || calendar.isDeleted) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch với calendarId đã cho',
        status: 404,
      });
    }

    if (boardId) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace || workspace.isDeleted) {
        return res.status(404).json({
          message: 'Không tìm thấy workspace với workspaceId đã cho',
          status: 404,
        });
      }

      const board = await Board.findById(boardId, { isDeleted: false });
      if (!board || board.isDeleted) {
        return res.status(404).json({
          message: 'Không tìm thấy board với boardId đã cho',
          status: 404,
        });
      }
      if (board.workspaceId.toString() !== workspace._id.toString()) {
        return res.status(400).json({
          message: 'Board không thuộc về workspace đã cho',
          status: 400,
        });
      }

      const isWorkspaceMember = workspace.members.some(
        (member) => member.toString() === organizer.toString()
      );

      if (
        !isWorkspaceMember &&
        workspace.creator.toString() !== organizer.toString()
      ) {
        return res.status(403).json({
          message: 'Bạn không có quyền tạo sự kiện trong workspace này',
          status: 403,
        });
      }

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

      if (participants && participants.length > 0) {
        for (const participant of participants) {
          const member = await BoardMembership.findOne({
            boardId: board._id,
            userId: participant.userId,
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

    if (!['online', 'offline'].includes(type)) {
      return res.status(400).json({
        message: 'Loại sự kiện không hợp lệ. Phải là "online" hoặc "offline"',
        status: 400,
      });
    } else if (type === 'offline' && !locationName && !address) {
      return res.status(400).json({
        message: 'Thiếu thông tin địa điểm cho sự kiện offline',
        status: 400,
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!allDay && start >= end) {
      return res.status(400).json({
        message: 'Thời gian bắt đầu phải trước thời gian kết thúc',
        status: 400,
      });
    }

    // Xử lý địa chỉ và geocoding
    const processedAddress = await processAddressData(
      locationName,
      address,
      type
    );

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

    const newEvent = new Event({
      title,
      description,
      calendarId,
      locationName: type === 'offline' ? locationName : null,
      address: processedAddress,
      type,
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
      try {
        const meetUrl = await createMeetSpace(req, 'meet', MEET_SCOPES);
        if (!meetUrl) {
          console.warn(
            'Không thể tạo Meet link, tiếp tục tạo event mà không có link'
          );
          // Vẫn tiếp tục tạo event nhưng không có onlineUrl
        } else {
          newEvent.onlineUrl = meetUrl;
          console.log('Meeting created:', meetUrl);
        }
      } catch (meetError) {
        console.error('Lỗi khi tạo Meet space:', meetError.message);
        // Nếu là lỗi authentication, ném lỗi để user phải auth lại
        if (meetError.statusCode === 401) {
          throw meetError;
        }
        // Với các lỗi khác, vẫn tạo event nhưng thông báo warning
        console.warn(
          'Tạo event mà không có Meet link do lỗi:',
          meetError.message
        );
      }
    }

    const savedEvent = await newEvent.save();

    // Đồng bộ với Google Calendar nếu user đã xác thực
    try {
      const googleEventId = await createGoogleCalendarEvent(organizer, {
        title: savedEvent.title,
        description: savedEvent.description,
        startDate: savedEvent.startDate,
        endDate: savedEvent.endDate,
        allDay: savedEvent.allDay,
        type: savedEvent.type,
        locationName: savedEvent.locationName,
        address: savedEvent.address,
        onlineUrl: savedEvent.onlineUrl,
        timeZone: savedEvent.timeZone,
        participants: savedEvent.participants,
      });

      if (googleEventId) {
        savedEvent.googleEventId = googleEventId;
        await savedEvent.save();
        console.log('Event synced to Google Calendar successfully');
      }
    } catch (error) {
      console.warn('Failed to sync to Google Calendar:', error.message);
      // Không làm gián đoạn quá trình tạo event
    }

    await EventHistory.create({
      eventId: savedEvent._id,
      action: 'create_event',
      participants: savedEvent.participants.map((p) => ({
        userId: p.userId,
        status: p.status,
      })),
    });

    // Gửi thông báo cho những người được mời tham gia sự kiện (ngoại trừ organizer)
    const participantsToNotify = savedEvent.participants.filter(
      (p) => p.userId.toString() !== organizer.toString()
    );

    if (participantsToNotify.length > 0) {
      try {
        const organizerUser = await User.findById(organizer, 'username email');
        const formattedEventStartDate = formatDateToTimeZone(
          savedEvent.startDate,
          savedEvent.timeZone
        );

        // Gửi thông báo cho từng participant
        for (const participant of participantsToNotify) {
          await NotificationService.createPersonalNotification({
            title: 'Lời mời tham gia sự kiện',
            content: `Bạn được mời tham gia sự kiện "${savedEvent.title}" bởi ${
              organizerUser.username || organizerUser.email
            }. Thời gian: ${formattedEventStartDate}`,
            type: 'event_invitation',
            targetUserId: participant.userId,
            createdBy: organizer,
            relatedUserId: organizer,
            eventId: savedEvent._id,
          });
        }

        console.log(
          `Đã gửi thông báo mời tham gia sự kiện cho ${participantsToNotify.length} người`
        );
      } catch (notificationError) {
        console.error(
          'Lỗi khi gửi thông báo mời tham gia sự kiện:',
          notificationError
        );
        // Không làm gián đoạn quá trình tạo event
      }
    }

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
      message: savedEvent.googleEventId
        ? 'Tạo sự kiện thành công và đã đồng bộ lên Google Calendar'
        : 'Tạo sự kiện thành công',
      status: 201,
      data: newEventResult,
    });
  } catch (error) {
    console.error('Lỗi khi tạo sự kiện:', error.stack); // Log stack trace
    res.status(error.statusCode || 500).json({
      message: error.message || 'Lỗi máy chủ',
      status: error.statusCode || 500,
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
      participantEmails,
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
      if (!address && !locationName) {
        return res.status(400).json({
          message: 'Thiếu thông tin địa điểm cho sự kiện offline',
          status: 400,
        });
      }

      event.type = 'offline';

      // Xử lý địa chỉ và geocoding
      const processedAddress = await processAddressData(
        locationName,
        address,
        'offline'
      );

      event.address = processedAddress;
      event.locationName = locationName || event.locationName;
      event.onlineUrl = null; // Đặt onlineUrl là null nếu là sự kiện offline
    } else {
      return res.status(400).json({
        message: 'Loại sự kiện không hợp lệ. Phải là "online" hoặc "offline"',
        status: 400,
      });
    }

    if (allDay === false && startDate && endDate) {
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

    // Process participant emails if provided
    if (
      participantEmails &&
      Array.isArray(participantEmails) &&
      participantEmails.length > 0
    ) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = participantEmails.filter(
        (email) => !emailRegex.test(email.trim())
      );

      if (invalidEmails.length > 0) {
        return res.status(400).json({
          message: `Email không hợp lệ: ${invalidEmails.join(', ')}`,
          status: 400,
        });
      }

      // Check if user is trying to invite themselves
      const currentUserEmail = req.user.email;
      const selfInvite = participantEmails.some(
        (email) => email.trim().toLowerCase() === currentUserEmail.toLowerCase()
      );

      if (selfInvite) {
        return res.status(400).json({
          message: 'Bạn không thể mời chính mình tham gia sự kiện',
          status: 400,
        });
      }

      // Find users by emails
      const cleanEmails = participantEmails.map((email) =>
        email.trim().toLowerCase()
      );
      const users = await User.find({
        email: { $in: cleanEmails },
        isDeleted: false,
      }).select('_id email');

      const foundEmails = users.map((user) => user.email.toLowerCase());
      const notFoundEmails = cleanEmails.filter(
        (email) => !foundEmails.includes(email)
      );

      if (notFoundEmails.length > 0) {
        return res.status(400).json({
          message: `Không tìm thấy người dùng với email: ${notFoundEmails.join(
            ', '
          )}`,
          status: 400,
        });
      }

      // Update participants - keep organizer, update others
      const organizerParticipant = event.participants.find(
        (p) => p.userId.toString() === req.user._id.toString()
      );
      const newParticipants = users.map((user) => ({
        userId: user._id,
        status: 'pending',
      }));

      // Lưu trữ participants cũ để so sánh
      const oldParticipantIds = event.participants.map((p) =>
        p.userId.toString()
      );

      event.participants = [organizerParticipant, ...newParticipants].filter(
        Boolean
      );

      // Tìm những participant mới được thêm vào
      const newParticipantIds = newParticipants.map((p) => p.userId.toString());
      const addedParticipantIds = newParticipantIds.filter(
        (id) => !oldParticipantIds.includes(id)
      );

      // Gửi thông báo cho những người mới được mời
      if (addedParticipantIds.length > 0) {
        const updatedEvent = await event.save();

        try {
          const organizerUser = await User.findById(
            req.user._id,
            'username email'
          );
          const formattedEventStartDate = formatDateToTimeZone(
            updatedEvent.startDate,
            updatedEvent.timeZone
          );

          // Gửi thông báo cho từng participant mới
          for (const participantId of addedParticipantIds) {
            await NotificationService.createPersonalNotification({
              title: 'Lời mời tham gia sự kiện',
              content: `Bạn được mời tham gia sự kiện "${
                updatedEvent.title
              }" bởi ${
                organizerUser.username || organizerUser.email
              }. Thời gian: ${formattedEventStartDate}`,
              type: 'event_invitation',
              targetUserId: participantId,
              createdBy: req.user._id,
              relatedUserId: req.user._id,
              eventId: updatedEvent._id,
            });
          }

          console.log(
            `Đã gửi thông báo mời tham gia sự kiện (cập nhật) cho ${addedParticipantIds.length} người`
          );
        } catch (notificationError) {
          console.error(
            'Lỗi khi gửi thông báo mời tham gia sự kiện (cập nhật):',
            notificationError
          );
          // Không làm gián đoạn quá trình cập nhật event
        }

        return updatedEvent;
      }
    }

    const updatedEvent = await event.save();

    // Đồng bộ với Google Calendar nếu có googleEventId
    if (updatedEvent.googleEventId) {
      try {
        await updateGoogleCalendarEvent(
          updatedEvent.organizer,
          updatedEvent.googleEventId,
          {
            title: updatedEvent.title,
            description: updatedEvent.description,
            startDate: updatedEvent.startDate,
            endDate: updatedEvent.endDate,
            allDay: updatedEvent.allDay,
            type: updatedEvent.type,
            locationName: updatedEvent.locationName,
            address: updatedEvent.address,
            onlineUrl: updatedEvent.onlineUrl,
            timeZone: updatedEvent.timeZone,
          }
        );
        console.log('Event updated on Google Calendar successfully');
      } catch (error) {
        console.warn('Failed to update Google Calendar event:', error.message);
      }
    }

    // Gửi thông báo cho những người đã tham gia trong sự kiện (chỉ những người là participants - đã accepted)

    res.status(200).json({
      message: updatedEvent.googleEventId
        ? 'Cập nhật sự kiện thành công và đã đồng bộ với Google Calendar'
        : 'Cập nhật sự kiện thành công',
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

    // Xóa sự kiện trên Google Calendar nếu có googleEventId
    if (event.googleEventId) {
      try {
        await deleteGoogleCalendarEvent(event.organizer, event.googleEventId);
        console.log('Event deleted from Google Calendar successfully');
      } catch (error) {
        console.warn('Failed to delete Google Calendar event:', error.message);
      }
    }

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

      // Gửi thông báo cho người được mời tham gia sự kiện
      try {
        const organizerUser = await User.findById(
          req.user._id,
          'username email'
        );
        const formattedEventStartDate = formatDateToTimeZone(
          event.startDate,
          event.timeZone || 'Asia/Ho_Chi_Minh'
        );

        await NotificationService.createPersonalNotification({
          title: 'Lời mời tham gia sự kiện',
          content: `Bạn được mời tham gia sự kiện "${event.title}" bởi ${
            organizerUser.username || organizerUser.email
          }. Thời gian: ${formattedEventStartDate}`,
          type: 'event_invitation',
          targetUserId: invitedUser._id,
          createdBy: req.user._id,
          relatedUserId: req.user._id,
          eventId: event._id,
        });

        console.log(
          `Đã gửi thông báo mời tham gia sự kiện cho user ${invitedUser._id}`
        );
      } catch (notificationError) {
        console.error(
          'Lỗi khi gửi thông báo mời tham gia sự kiện:',
          notificationError
        );
        // Không làm gián đoạn quá trình mời người tham gia
      }

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

    // Gửi thông báo cho organizer về việc participant đã cập nhật trạng thái
    try {
      const participantUser = await User.findById(
        req.user._id,
        'username email'
      );
      const formattedEventStartDate = formatDateToTimeZone(
        event.startDate,
        event.timeZone || 'Asia/Ho_Chi_Minh'
      );

      let statusText = '';
      switch (status) {
        case 'accepted':
          statusText = 'đã chấp nhận';
          break;
        case 'declined':
          statusText = 'đã từ chối';
          break;
        case 'pending':
          statusText = 'đang chờ xem xét';
          break;
        default:
          statusText = 'đã cập nhật trạng thái';
      }

      await NotificationService.createPersonalNotification({
        title: 'Cập nhật trạng thái tham gia sự kiện',
        content: `${
          participantUser.username || participantUser.email
        } ${statusText} tham gia sự kiện "${
          event.title
        }". Thời gian: ${formattedEventStartDate}`,
        type: 'event_status_update',
        targetUserId: event.organizer,
        createdBy: req.user._id,
        relatedUserId: req.user._id,
        eventId: event._id,
      });

      console.log(
        `Đã gửi thông báo cập nhật trạng thái sự kiện cho organizer ${event.organizer}`
      );
    } catch (notificationError) {
      console.error(
        'Lỗi khi gửi thông báo cập nhật trạng thái sự kiện:',
        notificationError
      );
      // Không làm gián đoạn quá trình cập nhật trạng thái
    }

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
