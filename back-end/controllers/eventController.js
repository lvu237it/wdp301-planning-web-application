const Event = require('../models/eventModel');
const Notification = require('../models/notificationModel');
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
const moment = require('moment-timezone');
const crypto = require('crypto');

const MEET_SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Helper function để xử lý địa chỉ và geocoding
const processAddressData = async (addressInput, type) => {
  if (type === 'online') {
    return null; // Sự kiện online không cần address
  }

  if (!addressInput || addressInput.trim() === '') {
    return null; // Không có thông tin địa chỉ
  }

  const trimmedAddress = addressInput.trim();

  // Thử geocoding
  const geocodedData = await geocodeAddress(trimmedAddress);

  if (geocodedData) {
    // Nếu geocoding thành công, trả về object đầy đủ
    return geocodedData;
  } else {
    // Nếu geocoding thất bại, vẫn lưu thông tin cơ bản
    console.warn('Geocoding failed, saving basic address info');
    return {
      type: 'Point',
      coordinates: null,
      formattedAddress: trimmedAddress,
      placeId: null,
      mapZoomLevel: 15,
    };
  }
};

// Helper function để tạo sự kiện trên Google Calendar
const createGoogleCalendarEvent = async (userId, eventData) => {
  try {
    console.log(
      '[eventController.js][createGoogleCalendarEvent] Bắt đầu tạo sự kiện Google Calendar cho user:',
      userId,
      'Tiêu đề:',
      eventData.title
    );
    let auth;
    try {
      auth = await authorize(userId, 'calendar', CALENDAR_SCOPES);
    } catch (err) {
      if (
        err.statusCode === 401 &&
        err.message.includes('Vui lòng xác thực lại')
      ) {
        return {
          error: true,
          needReauth: true,
          message:
            'Google token đã hết hạn hoặc không còn hiệu lực. Vui lòng xác thực lại Google để tiếp tục sử dụng tính năng này.',
          authUrl: err.message.split('Vui lòng xác thực lại: ')[1] || null,
        };
      }
      throw err;
    }
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
          ? eventData.address?.formattedAddress || ''
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
            // Math.random().toString(36).substring(2, 9),
            crypto.randomBytes(5).toString('hex'), // Sử dụng crypto để tạo ID ngẫu nhiên
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

    console.log(
      '[eventController.js][createGoogleCalendarEvent] Đã tạo sự kiện Google Calendar, eventId:',
      response.data.id
    );
    return response.data.id; // Trả về Google event ID
  } catch (error) {
    console.error(
      '[eventController.js][createGoogleCalendarEvent] Lỗi tạo sự kiện Google Calendar:',
      error.message
    );
    return null;
  }
};

// Thêm hàm findAvailableTimeSlots
const findAvailableTimeSlots = async (
  organizerId,
  participantIds,
  startDate,
  endDate,
  duration,
  timeZone = 'Asia/Ho_Chi_Minh'
) => {
  try {
    const searchStart = moment.tz(startDate, timeZone).startOf('day').toDate();
    const searchEnd = moment.tz(endDate, timeZone).endOf('day').toDate();
    const requiredDuration = moment.duration(duration, 'minutes');

    // Tìm tất cả sự kiện của organizer và participants trong khoảng thời gian
    const allParticipants = [organizerId, ...participantIds];
    const events = await Event.find({
      isDeleted: false,
      status: { $nin: ['completed', 'cancelled'] },
      participants: {
        $elemMatch: {
          userId: { $in: allParticipants },
          status: 'accepted',
        },
      },
      $or: [
        // Sự kiện allDay
        {
          allDay: true,
          startDate: {
            $gte: searchStart,
            $lte: searchEnd,
          },
        },
        // Sự kiện không phải allDay
        {
          allDay: false,
          $or: [
            { startDate: { $lte: searchEnd } },
            { endDate: { $gte: searchStart } },
          ],
        },
      ],
    }).select('startDate endDate allDay');

    // Tạo danh sách các khoảng thời gian bận
    const busySlots = events.map((event) => ({
      start: moment.tz(event.startDate, timeZone),
      end: moment.tz(event.endDate, timeZone),
      allDay: event.allDay,
    }));

    // Tìm các khoảng thời gian trống, phân chia theo buổi
    const morningSlots = [];
    const afternoonSlots = [];

    // Lặp qua từng ngày trong khoảng tìm kiếm
    let currentDay = moment.tz(searchStart, timeZone);
    const lastDay = moment.tz(searchEnd, timeZone);

    while (currentDay.isSameOrBefore(lastDay, 'day')) {
      // Kiểm tra xem ngày hiện tại có sự kiện allDay nào không
      const hasAllDayEvent = busySlots.some(
        (slot) => slot.allDay && currentDay.isSame(slot.start, 'day')
      );

      if (!hasAllDayEvent) {
        // Buổi sáng: 1:00 - 12:00
        let morningStart = currentDay.clone().set({ hour: 1, minute: 0 });
        const morningEnd = currentDay.clone().set({ hour: 12, minute: 0 });

        // Buổi chiều: 13:00 - 23:59
        let afternoonStart = currentDay.clone().set({ hour: 13, minute: 0 });
        const afternoonEnd = currentDay.clone().set({ hour: 23, minute: 59 });

        // Kiểm tra slots buổi sáng
        while (
          morningStart.clone().add(requiredDuration).isSameOrBefore(morningEnd)
        ) {
          const slotEnd = morningStart.clone().add(requiredDuration);
          const isSlotFree = !busySlots.some((busy) => {
            if (busy.allDay) {
              return morningStart.isSame(busy.start, 'day');
            }
            return (
              morningStart.isBefore(busy.end) && slotEnd.isAfter(busy.start)
            );
          });

          if (isSlotFree && morningStart.isAfter(moment.tz(timeZone))) {
            morningSlots.push({
              startDate: morningStart.toDate(),
              endDate: slotEnd.toDate(),
              period: 'morning',
            });
          }
          morningStart.add(30, 'minutes');
        }

        // Kiểm tra slots buổi chiều
        while (
          afternoonStart
            .clone()
            .add(requiredDuration)
            .isSameOrBefore(afternoonEnd)
        ) {
          const slotEnd = afternoonStart.clone().add(requiredDuration);
          const isSlotFree = !busySlots.some((busy) => {
            if (busy.allDay) {
              return afternoonStart.isSame(busy.start, 'day');
            }
            return (
              afternoonStart.isBefore(busy.end) && slotEnd.isAfter(busy.start)
            );
          });

          if (isSlotFree && afternoonStart.isAfter(moment.tz(timeZone))) {
            afternoonSlots.push({
              startDate: afternoonStart.toDate(),
              endDate: slotEnd.toDate(),
              period: 'afternoon',
            });
          }
          afternoonStart.add(30, 'minutes');
        }
      }

      currentDay.add(1, 'day');
    }

    // Lấy tối đa 3 slots cho mỗi buổi
    const suggestedSlots = [
      ...morningSlots.slice(0, 3),
      ...afternoonSlots.slice(0, 3),
    ];

    // Sắp xếp theo thời gian
    return suggestedSlots.sort(
      (a, b) => moment(a.startDate).valueOf() - moment(b.startDate).valueOf()
    );
  } catch (error) {
    console.error('Error finding available time slots:', error);
    return [];
  }
};

// Thêm endpoint mới
exports.findAvailableTimeSlots = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      duration, // Thời lượng sự kiện (phút)
      participantEmails,
      timeZone = 'Asia/Ho_Chi_Minh',
    } = req.body;
    const organizerId = req.user._id;

    if (!startDate || !endDate || !duration) {
      return res.status(400).json({
        message: 'Missing required fields: startDate, endDate, duration',
        status: 400,
      });
    }

    // Xử lý participant emails
    let participantIds = [];
    if (
      participantEmails &&
      participantEmails.length > 0 &&
      Array.isArray(participantEmails)
    ) {
      const cleanEmails = participantEmails.map((email) =>
        email.trim().toLowerCase()
      );
      const users = await User.find({
        email: { $in: cleanEmails },
        isDeleted: false,
      }).select('_id');

      participantIds = users.map((user) => user._id);
    }

    const availableSlots = await findAvailableTimeSlots(
      organizerId,
      participantIds,
      startDate,
      endDate,
      duration,
      timeZone
    );

    res.status(200).json({
      message: 'Successfully found available time slots',
      status: 200,
      data: availableSlots,
    });
  } catch (error) {
    console.error('Error in findAvailableTimeSlots:', error);
    res.status(500).json({
      message: 'Error finding available time slots',
      status: 500,
    });
  }
};

// Cập nhật createEventForCalendar (thay thế phần cũ)
exports.createEventForCalendar = async (req, res) => {
  try {
    const {
      title,
      description,
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
      participantEmails,
      forceCreate,
    } = req.body;
    const { calendarId } = req.params;
    const organizer = req.user._id;
    let participants = [{ userId: organizer, status: 'accepted' }];

    // Validate required fields
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
          'Missing required fields: title, calendarId, startDate, endDate, organizer hoặc type',
        status: 400,
      });
    }

    // Xử lý participant emails
    if (
      participantEmails &&
      Array.isArray(participantEmails) &&
      participantEmails.length > 0
    ) {
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

      const currentUserEmail = req.user.email;
      const selfInvite = participantEmails.some(
        (email) => email.trim().toLowerCase() === currentUserEmail.toLowerCase()
      );

      if (selfInvite) {
        return res.status(400).json({
          message: 'You can not invite yourself to an event',
          status: 400,
        });
      }

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
          message: `User with email ${notFoundEmails.join(', ')} not found`,
          status: 400,
        });
      }

      const participantUsers = users.map((user) => ({
        userId: user._id,
        status: 'pending',
      }));

      participants = [...participants, ...participantUsers];
    }

    const calendar = await Calendar.findById(calendarId);
    if (!calendar || calendar.isDeleted) {
      return res.status(404).json({
        message: 'Calendar not found with the given calendarId',
        status: 404,
      });
    }

    // Validate workspace and board
    if (boardId) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace || workspace.isDeleted) {
        return res.status(404).json({
          message: 'Workspace not found with the given workspaceId',
          status: 404,
        });
      }

      const board = await Board.findById(boardId, { isDeleted: false });
      if (!board || board.isDeleted) {
        return res.status(404).json({
          message: 'Board not found with the given boardId',
          status: 404,
        });
      }

      if (board.workspaceId.toString() !== workspace._id.toString()) {
        return res.status(400).json({
          message: 'Board does not belong to the specified workspace',
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
          message: 'You have not permission to create events in this workspace',
          status: 403,
        });
      }

      const boardMembership = await BoardMembership.findOne({
        boardId: board._id,
        userId: organizer,
      });

      if (!boardMembership) {
        return res.status(403).json({
          message: 'You are not a member of this board',
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
              message: `User ${participant.userId} is not a member of this board`,
              status: 403,
            });
          }
        }
      }
    }

    // Validate event type and address
    if (!['online', 'offline'].includes(type)) {
      return res.status(400).json({
        message: 'Event type must be "online" or "offline"',
        status: 400,
      });
    } else if (type === 'offline' && !address) {
      return res.status(400).json({
        message: 'Missing address for offline event',
        status: 400,
      });
    }

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!allDay && start < now) {
      return res.status(400).json({
        message: 'Start time cannot be in the past',
        status: 400,
      });
    }

    if (!allDay && end < now) {
      return res.status(400).json({
        message: 'End time cannot be in the past',
        status: 400,
      });
    }

    if (!allDay && start >= end) {
      return res.status(400).json({
        message: 'Start time must be before end time',
        status: 400,
      });
    }

    // Kiểm tra xung đột thời gian
    if (!forceCreate) {
      try {
        let allConflictingEvents = [];

        // BƯỚC 1: Chuẩn hóa thời gian cho sự kiện mới
        const moment = require('moment-timezone');
        const timeZone = 'Asia/Ho_Chi_Minh';

        let newEventStart, newEventEnd;

        if (allDay) {
          // Đối với allDay events, chuẩn hóa về đầu và cuối ngày
          newEventStart = moment.tz(start, timeZone).startOf('day').toDate();
          newEventEnd = moment.tz(end, timeZone).endOf('day').toDate();
        } else {
          // Đối với normal events, giữ nguyên thời gian nhưng đảm bảo timezone
          newEventStart = moment.tz(start, timeZone).toDate();
          newEventEnd = moment.tz(end, timeZone).toDate();
        }

        // BƯỚC 2: Ưu tiên check sự kiện allDay trước
        if (allDay) {
          // Nếu sự kiện mới là allDay, tìm tất cả allDay events trong cùng ngày
          const dayString = moment
            .tz(newEventStart, timeZone)
            .format('YYYY-MM-DD');

          const allDayConflictQuery = {
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: organizer,
                status: 'accepted',
              },
            },
            allDay: true,
            $expr: {
              $eq: [
                {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$startDate',
                    timezone: timeZone,
                  },
                },
                dayString,
              ],
            },
          };

          const allDayConflicts = await Event.find(allDayConflictQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...allDayConflicts);

          // Tìm normal events overlap với ngày allDay này
          const normalVsAllDayQuery = {
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: organizer,
                status: 'accepted',
              },
            },
            allDay: { $ne: true },
            $and: [
              { startDate: { $lte: newEventEnd } },
              { endDate: { $gte: newEventStart } },
            ],
          };

          const normalConflicts = await Event.find(normalVsAllDayQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...normalConflicts);
        } else {
          // Nếu sự kiện mới là normal event

          // Tìm allDay events trong các ngày liên quan
          const startDay = moment
            .tz(newEventStart, timeZone)
            .format('YYYY-MM-DD');
          const endDay = moment.tz(newEventEnd, timeZone).format('YYYY-MM-DD');

          // Tạo danh sách ngày để check
          const dayStrings = [];
          const currentMoment = moment
            .tz(newEventStart, timeZone)
            .startOf('day');
          const endMoment = moment.tz(newEventEnd, timeZone).startOf('day');

          while (currentMoment.isSameOrBefore(endMoment, 'day')) {
            dayStrings.push(currentMoment.format('YYYY-MM-DD'));
            currentMoment.add(1, 'day');
          }

          const allDayVsNormalQuery = {
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: organizer,
                status: 'accepted',
              },
            },
            allDay: true,
            $expr: {
              $in: [
                {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$startDate',
                    timezone: timeZone,
                  },
                },
                dayStrings,
              ],
            },
          };

          const allDayConflicts = await Event.find(allDayVsNormalQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...allDayConflicts);

          // Tìm normal events overlap về thời gian
          const normalVsNormalQuery = {
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: organizer,
                status: 'accepted',
              },
            },
            allDay: { $ne: true },
            startDate: { $lt: newEventEnd },
            endDate: { $gt: newEventStart },
          };

          const normalConflicts = await Event.find(normalVsNormalQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...normalConflicts);
        }

        // Loại bỏ duplicate events
        const conflictingEvents = allConflictingEvents.filter(
          (event, index, self) =>
            index ===
            self.findIndex((e) => e._id.toString() === event._id.toString())
        );

        if (conflictingEvents.length > 0) {
          const conflictDetails = conflictingEvents.map((conflictEvent) => ({
            id: conflictEvent._id,
            title: conflictEvent.title,
            startDate: conflictEvent.startDate,
            endDate: conflictEvent.endDate,
            allDay: conflictEvent.allDay,
          }));

          // Trả về dữ liệu để frontend hiển thị modal xung đột
          return res.status(409).json({
            message:
              'You have an appointment within this time frame, so please consider carefully.',
            status: 409,
            hasConflict: true,
            conflictingEvents: conflictDetails,
            newEvent: {
              title,
              startDate: newEventStart,
              endDate: newEventEnd,
              allDay,
            },
          });
        }
      } catch (conflictError) {
        console.error('Lỗi khi kiểm tra xung đột thời gian:', conflictError);
      }
    }

    // Xử lý địa chỉ
    const processedAddress = await processAddressData(address, type);

    // Validate status và category
    if (
      status &&
      !['draft', 'scheduled', 'completed', 'cancelled'].includes(status)
    ) {
      return res.status(400).json({
        message:
          // 'Trạng thái không hợp lệ. Phải là "draft", "scheduled", "completed" hoặc "cancelled"',
          'Event status must be "draft", "scheduled", "completed" or "cancelled"',
        status: 400,
      });
    }

    if (
      category &&
      !['workshop', 'meeting', 'party', 'other'].includes(category)
    ) {
      return res.status(400).json({
        message:
          // 'Loại sự kiện không hợp lệ. Phải là "workshop", "meeting", "party" hoặc "other"',
          'Event category must be "workshop", "meeting", "party" or "other"',
        status: 400,
      });
    }

    // Tạo sự kiện mới
    const newEvent = new Event({
      title,
      description,
      calendarId,
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

    // Tạo Meet link nếu là sự kiện online
    if (type === 'online') {
      try {
        const meetUrl = await createMeetSpace(req, 'meet', MEET_SCOPES);
        if (!meetUrl) {
          console.warn(
            'Cannot create Meet space, skipping link creation. You can try to create it later by updating the event.'
          );
          // Fallback: tạo link Meet thủ công hoặc để trống để user tự thêm
          newEvent.onlineUrl = null; // User có thể thêm link sau
        } else {
          newEvent.onlineUrl = meetUrl;
          console.log('Meeting created:', meetUrl);
        }
      } catch (meetError) {
        console.error('Error creating meeting:', meetError.message);
        if (meetError.statusCode === 401) {
          throw meetError;
        }
        console.warn(
          'Tạo event mà không có Meet link do lỗi:',
          meetError.message
        );
        // Fallback: để null để user có thể thêm link sau
        newEvent.onlineUrl = null;
      }
    }

    const savedEvent = await newEvent.save();

    // Đồng bộ Google Calendar
    try {
      const googleEventId = await createGoogleCalendarEvent(organizer, {
        title: savedEvent.title,
        description: savedEvent.description,
        startDate: savedEvent.startDate,
        endDate: savedEvent.endDate,
        allDay: savedEvent.allDay,
        type: savedEvent.type,
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
    }

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

        for (const participant of participantsToNotify) {
          await NotificationService.createPersonalNotification({
            title: 'Invitation to join event',
            content: `You have been invited to join the event "${savedEvent.title}" by ${organizerUser.username}.`,
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
        ? 'Create event successfully and synced to Google Calendar'
        : 'Create event successfully (without Google Calendar sync)',
      status: 201,
      data: newEventResult,
    });
  } catch (error) {
    console.error('Error while creating event:', error.stack);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Error creating event',
      status: error.statusCode || 500,
    });
  }
};

// Check for event conflicts
exports.checkEventConflicts = async (req, res) => {
  try {
    const { startDate, endDate, boardId, excludeEventId } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
    }

    // Build query to find conflicting events
    const conflictQuery = {
      isDeleted: false,
      $or: [
        {
          // Event starts during the proposed time
          startDate: {
            $gte: new Date(startDate),
            $lt: new Date(endDate),
          },
        },
        {
          // Event ends during the proposed time
          endDate: {
            $gt: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
        {
          // Event completely overlaps the proposed time
          startDate: { $lte: new Date(startDate) },
          endDate: { $gte: new Date(endDate) },
        },
      ],
    };

    // Add board filter if provided
    if (boardId) {
      conflictQuery.boardId = boardId;
    } else {
      // If no boardId, check user's events
      conflictQuery.$or.push(
        { organizer: userId },
        { 'participants.userId': userId }
      );
    }

    // Exclude the current event being edited
    if (excludeEventId) {
      conflictQuery._id = { $ne: excludeEventId };
    }

    // Find conflicting events
    const conflicts = await Event.find(conflictQuery)
      .populate('organizer', 'username email')
      .populate('calendarId', 'name')
      .populate('boardId', 'name')
      .sort({ startDate: 1 })
      .limit(10); // Limit to 10 conflicts

    const hasConflict = conflicts.length > 0;

    return res.status(200).json({
      success: true,
      data: {
        hasConflict,
        conflicts: conflicts.map((event) => ({
          _id: event._id,
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          organizer: event.organizer,
          calendar: event.calendarId,
          board: event.boardId,
          type: event.type,
          status: event.status,
        })),
        conflictCount: conflicts.length,
      },
    });
  } catch (error) {
    console.error('Error checking event conflicts:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking event conflicts',
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

// Helper function để xác định trạng thái sự kiện dựa trên thời gian
const determineEventStatus = (
  startDate,
  endDate,
  currentStatus,
  isAllDay = false
) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Nếu sự kiện đã được hủy, giữ nguyên
  if (currentStatus === 'cancelled') {
    return currentStatus;
  }

  if (isAllDay) {
    // Với sự kiện allDay, chỉ so sánh theo ngày
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);

    // Nếu ngày hiện tại đã qua ngày kết thúc
    if (today > endDay) {
      return 'completed';
    }

    // Nếu ngày hiện tại nằm trong khoảng sự kiện
    if (today >= startDay && today <= endDay) {
      return 'in-progress';
    }

    // Nếu ngày hiện tại chưa tới ngày bắt đầu
    if (today < startDay) {
      return 'scheduled';
    }
  } else {
    // Xử lý cho sự kiện không phải allDay (giữ nguyên logic cũ)
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
  }
};

// Lấy tất cả sự kiện mà user đã chấp nhận tham gia từ lịch của người khác
exports.getParticipatedEvents = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    // Build query để tìm events mà user tham gia với status 'accepted'
    const query = {
      participants: {
        $elemMatch: {
          userId: userId,
          status: 'accepted',
        },
      },
      isDeleted: false,
    };

    // Lọc theo khoảng thời gian nếu có
    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const events = await Event.find(query)
      .populate('participants.userId', 'name email username')
      .populate('organizer', 'name email username')
      .populate('calendarId', 'name color ownerId')
      .populate('workspaceId', 'name')
      .populate('boardId', 'name')
      .select('-isDeleted -deletedAt');

    // Lọc ra những sự kiện không thuộc về lịch của chính user này
    const participatedEvents = events.filter(
      (event) => event.calendarId?.ownerId.toString() !== userId.toString()
    );

    // Format cho FullCalendar
    const fullCalendarEvents = participatedEvents.map((event) => {
      // Tìm organizer info
      const organizerParticipant = event.participants.find(
        (p) => p.userId._id.toString() === event.organizer._id.toString()
      );

      return {
        id: event._id.toString(),
        title: `[Tham gia] ${event.title}`, // Thêm prefix để phân biệt
        start: event.startDate,
        end: event.endDate,
        allDay: event.allDay || false,
        backgroundColor: event.color || event.calendarId.color || '#6c757d',
        borderColor: event.color || event.calendarId.color || '#6c757d',
        textColor: '#ffffff',
        extendedProps: {
          description: event.description,
          locationName: event.locationName,
          address: event.address, // Trả về toàn bộ address object
          type: event.type,
          onlineUrl: event.onlineUrl, // Đảm bảo onlineUrl được trả về
          meetingCode: event.meetingCode, // Đảm bảo meetingCode được trả về
          timeZone: event.timeZone,
          organizer: {
            userId: event.organizer._id,
            username: event.organizer.username || event.organizer.name,
            email: event.organizer.email,
          },
          participants: event.participants.map((p) => ({
            userId: p.userId._id,
            name: p.userId.name || p.userId.username,
            email: p.userId.email,
            status: p.status,
          })),
          calendar: {
            id: event.calendarId._id,
            name: event.calendarId.name,
            color: event.calendarId.color,
            isOwn: false, // Đánh dấu đây không phải lịch của mình
          },
          workspace: event.workspaceId
            ? { id: event.workspaceId._id, name: event.workspaceId.name }
            : null,
          board: event.boardId
            ? { id: event.boardId._id, name: event.boardId.name }
            : null,
          status: event.status,
          category: event.category,
          isOwn: false, // Đánh dấu đây không phải sự kiện của mình
          rrule: event.recurrence
            ? convertToRRule(event.recurrence)
            : undefined,
        },
      };
    });

    res.status(200).json({
      message: 'Successfully get participated events',
      status: 200,
      data: fullCalendarEvents,
    });
  } catch (error) {
    console.error('Error get participated events:', error);
    res.status(500).json({
      message: 'Error get participated events',
      status: 500,
      error: error.message,
    });
  }
};

// Helper function để cập nhật sự kiện trên Google Calendar
const updateGoogleCalendarEvent = async (userId, googleEventId, eventData) => {
  try {
    console.log(
      '[eventController.js][updateGoogleCalendarEvent] Bắt đầu cập nhật sự kiện Google Calendar:',
      googleEventId
    );
    let auth;
    try {
      auth = await authorize(userId, 'calendar', CALENDAR_SCOPES);
    } catch (err) {
      if (
        err.statusCode === 401 &&
        err.message.includes('Vui lòng xác thực lại')
      ) {
        return {
          error: true,
          needReauth: true,
          message:
            'Google token đã hết hạn hoặc không còn hiệu lực. Vui lòng xác thực lại Google để tiếp tục sử dụng tính năng này.',
          authUrl: err.message.split('Vui lòng xác thực lại: ')[1] || null,
        };
      }
      throw err;
    }
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
          ? eventData.address?.formattedAddress || ''
          : undefined,
      attendees: participantEmails,
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: googleEvent,
    });

    console.log(
      '[eventController.js][updateGoogleCalendarEvent] Đã cập nhật sự kiện Google Calendar:',
      response.data.id
    );
    return true;
  } catch (error) {
    console.error(
      '[eventController.js][updateGoogleCalendarEvent] Lỗi cập nhật sự kiện Google Calendar:',
      error.message
    );
    return false;
  }
};

// Helper function để xóa sự kiện trên Google Calendar
const deleteGoogleCalendarEvent = async (userId, googleEventId) => {
  try {
    console.log(
      '[eventController.js][deleteGoogleCalendarEvent] Bắt đầu xóa sự kiện Google Calendar:',
      googleEventId
    );
    let auth;
    try {
      auth = await authorize(userId, 'calendar', CALENDAR_SCOPES);
    } catch (err) {
      if (
        err.statusCode === 401 &&
        err.message.includes('Vui lòng xác thực lại')
      ) {
        return {
          error: true,
          needReauth: true,
          message:
            'Google token đã hết hạn hoặc không còn hiệu lực. Vui lòng xác thực lại Google để tiếp tục sử dụng tính năng này.',
          authUrl: err.message.split('Vui lòng xác thực lại: ')[1] || null,
        };
      }
      throw err;
    }
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });
    console.log(
      '[eventController.js][deleteGoogleCalendarEvent] Đã xóa sự kiện Google Calendar:',
      googleEventId
    );
    return true;
  } catch (error) {
    console.error(
      '[eventController.js][deleteGoogleCalendarEvent] Lỗi xóa sự kiện Google Calendar:',
      error.message
    );
    return false;
  }
};

exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: 'Missing event ID',
        status: 400,
      });
    }
    const event = await Event.findById(id)
      .populate('participants.userId', 'name email')
      .populate('calendarId', 'name color')
      .populate('workspaceId', 'name');
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Event is not found or has been deleted',
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
      message: 'Successfully retrieved event details',
      status: 200,
      data: fullCalendarEvent,
    });
  } catch (error) {
    console.error('Error while getting event details:', error);
    res.status(500).json({
      message: 'Error while getting event details',
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
      .populate('participants.userId', 'name email username') // Thêm username
      .populate('organizer', 'name email username') // Populate organizer đầy đủ
      .populate('calendarId', 'name color') // Chỉ lấy name và color của lịch
      .populate('workspaceId', 'name') // Chỉ lấy name của workspace
      .populate('boardId', 'name'); // Chỉ lấy name của board
    // Chuyển đổi dữ liệu cho FullCalendar
    const fullCalendarEvents = events.map((event) => {
      const organizerFound = event.participants.find(
        (p) => p.userId._id.toString() === event.organizer._id.toString()
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
          address: event.address, // Trả về toàn bộ address object
          type: event.type,
          onlineUrl: event.onlineUrl, // Đảm bảo onlineUrl được trả về
          meetingCode: event.meetingCode, // Đảm bảo meetingCode được trả về
          timeZone: event.timeZone,
          organizer: {
            userId: event.organizer._id,
            name: event.organizer.name || event.organizer.username,
            email: event.organizer.email,
          },
          participants: event.participants.map((p) => ({
            userId: p.userId._id,
            name: p.userId.name || p.userId.username,
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
          status: event.status,
          category: event.category,
        },
      };
    });
    res.status(200).json({
      message: 'Successfully retrieved all events',
      status: 200,
      data: fullCalendarEvents,
    });
  } catch (error) {
    console.error('Successfully retrieved all events:', error);
    res.status(500).json({
      message: 'Successfully retrieved all events',
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
      address,
      type,
      startDate,
      endDate,
      allDay,
      recurrence,
      reminderSettings,
      status,
      category,
      color,
      participantEmails,
      onlineUrl,
      meetingCode,
    } = req.body;

    //Cho phép cập nhật 1 số trường có thể thay đổi nhiều, không bao gồm participants, organizer, calendarId, workspaceId, boardId
    if (!id) {
      return res.status(400).json({
        message: 'Missing event ID',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Event not found or has been deleted',
        status: 404,
      });
    }

    //Kiểm tra xem người đăng nhập có phải là người tạo event không, nếu không thì không thể cập nhật
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You do not have permission to update this event',
        status: 403,
      });
    }

    // Kiểm tra trạng thái sự kiện có thể chỉnh sửa không
    if (event.status === 'in-progress' || event.status === 'completed') {
      return res.status(400).json({
        message: 'You cannot update an event that is in progress or completed',
        status: 400,
      });
    }
    //Nếu sự kiện online thì có thể cập nhật onlineUrl hoặc meetingCode
    if (type === 'online') {
      event.type = 'online'; // Đặt type là online
      event.address = null; // Đặt address là null nếu là sự kiện online

      // Cập nhật onlineUrl nếu được cung cấp từ frontend
      if (onlineUrl !== undefined) {
        event.onlineUrl = onlineUrl;
      }

      // Cập nhật meetingCode nếu được cung cấp từ frontend
      if (meetingCode !== undefined) {
        event.meetingCode = meetingCode;
      }

      //Nếu sự kiện online nhưng chưa có onlineUrl và không được cung cấp từ frontend
      if (!event.onlineUrl && onlineUrl === undefined) {
        try {
          const meetUrl = await createMeetSpace(req, 'meet', MEET_SCOPES);
          if (!meetUrl) {
            console.warn(
              'Không thể tạo Meet link, tiếp tục cập nhật event mà không có link'
            );
          } else {
            event.onlineUrl = meetUrl;
          }
        } catch (meetError) {
          console.error('Lỗi khi tạo Meet space:', meetError.message);
          // Nếu là lỗi authentication, ném lỗi để user phải auth lại
          if (meetError.statusCode === 401) {
            throw meetError;
          }
          // Với các lỗi khác, vẫn cập nhật event nhưng thông báo warning
          console.warn(
            'Cập nhật event mà không có Meet link do lỗi:',
            meetError.message
          );
        }
      }
    } else if (type === 'offline') {
      //Nếu sự kiện offline thì có thể cập nhật address
      if (!address) {
        return res.status(400).json({
          message: 'Missing address for offline event',
          status: 400,
        });
      }

      event.type = 'offline';

      // Chỉ xử lý address mới nếu thực sự có thay đổi
      // So sánh với dữ liệu hiện tại để tránh duplicate
      const currentFormattedAddress = event.address?.formattedAddress || '';
      const hasAddressChanged = address !== currentFormattedAddress;

      if (hasAddressChanged) {
        // Chỉ khi có thay đổi thực sự mới gọi processAddressData
        const processedAddress = await processAddressData(address, 'offline');
        event.address = processedAddress;
      }

      event.onlineUrl = null; // Đặt onlineUrl là null nếu là sự kiện offline
      event.meetingCode = null; // Đặt meetingCode là null nếu là sự kiện offline
    } else {
      return res.status(400).json({
        message: 'Event type must be "online" or "offline"',
        status: 400,
      });
    }

    // Chỉ cập nhật startDate và endDate nếu chúng được gửi trong request
    const now = new Date();

    if (startDate !== undefined) {
      const start = new Date(startDate);

      // Kiểm tra startDate không được trong quá khứ
      if (start < now) {
        return res.status(400).json({
          message: 'Start date cannot be in the past',
          status: 400,
        });
      }

      // Kiểm tra thời gian bắt đầu và kết thúc nếu không phải sự kiện cả ngày
      if (allDay === false && endDate !== undefined) {
        const end = new Date(endDate);

        // Kiểm tra endDate không được trong quá khứ
        if (end < now) {
          return res.status(400).json({
            message: 'End date cannot be in the past',
            status: 400,
          });
        }

        if (start >= end) {
          return res.status(400).json({
            message: 'Start time must be before end time',
            status: 400,
          });
        }
        event.endDate = end;
      } else if (allDay === false && endDate === undefined) {
        // Nếu chỉ có startDate mà không có endDate, kiểm tra với endDate hiện tại
        if (start >= event.endDate) {
          return res.status(400).json({
            message: 'Start time must be before end time',
            status: 400,
          });
        }
      }

      event.startDate = start;
    }

    if (endDate !== undefined && startDate === undefined) {
      const end = new Date(endDate);

      // Kiểm tra endDate không được trong quá khứ
      if (end < now) {
        return res.status(400).json({
          message: 'End date cannot be in the past',
          status: 400,
        });
      }

      // Nếu chỉ có endDate mà không có startDate, kiểm tra với startDate hiện tại
      if (allDay === false && event.startDate >= end) {
        return res.status(400).json({
          message: 'Start time must be before end time',
          status: 400,
        });
      }

      event.endDate = end;
    }
    // Cập nhật các trường khác
    event.title = title || event.title;
    event.description =
      description !== undefined ? description : event.description;
    event.allDay = allDay !== undefined ? allDay : event.allDay;
    event.recurrence = recurrence !== undefined ? recurrence : event.recurrence;
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
          message: `Email is not valid: ${invalidEmails.join(', ')}`,
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
          message: 'You cannot invite yourself to an event',
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
          message: `User with email: ${notFoundEmails.join(', ')} not found`,
          status: 400,
        });
      }

      // LOGIC CỘNG DỒN - Chỉ thêm participants mới, không ghi đè
      // Giữ nguyên tất cả participants hiện tại
      const existingParticipants = [...event.participants];
      const newlyInvitedIds = [];
      const reinvitedIds = [];

      // Chỉ xử lý những email mới được nhập vào
      for (const user of users) {
        const existingParticipant = existingParticipants.find(
          (p) => p.userId.toString() === user._id.toString()
        );

        if (existingParticipant) {
          // Người dùng đã tồn tại trong danh sách participants
          if (existingParticipant.status === 'declined') {
            // Nếu đã từ chối trước đó, cập nhật thành pending để mời lại
            existingParticipant.status = 'pending';
            reinvitedIds.push(user._id.toString());
          } else if (existingParticipant.status === 'accepted') {
            // Nếu đã chấp nhận, giữ nguyên status
            console.log(
              `Người dùng ${user.email} đã chấp nhận, giữ nguyên status`
            );
          } else if (existingParticipant.status === 'pending') {
            // Nếu đang pending, giữ nguyên
            console.log(
              `Người dùng ${user.email} đang pending, giữ nguyên status`
            );
          }
          // Không cần push vì đã có trong existingParticipants
        } else {
          // Người dùng mới, thêm vào danh sách participants
          const newParticipant = {
            userId: user._id,
            status: 'pending',
          };
          existingParticipants.push(newParticipant);
          newlyInvitedIds.push(user._id.toString());
          console.log(`Mời mới người dùng ${user.email}`);
        }
      }

      // Cập nhật danh sách participants (giữ nguyên + thêm mới)
      event.participants = existingParticipants;

      // Gửi thông báo cho những người mới được mời và những người được mời lại (nhưng không return sớm)
      const notificationTargetIds = [...newlyInvitedIds, ...reinvitedIds];

      if (notificationTargetIds.length > 0) {
        // Gửi thông báo async sau khi save event (không chặn flow chính)
        setImmediate(async () => {
          try {
            const organizerUser = await User.findById(
              req.user._id,
              'username email'
            );

            // Gửi thông báo cho từng participant
            for (const participantId of notificationTargetIds) {
              const notificationContent = `You have been invited to join event "${event.title}" by ${organizerUser.username}.`;

              await NotificationService.createPersonalNotification({
                title: 'Invitation to join event',
                content: notificationContent,
                type: 'event_invitation',
                targetUserId: participantId,
                createdBy: req.user._id,
                relatedUserId: null,
                eventId: event._id,
              });
            }

            console.log(
              `Đã gửi thông báo mời tham gia sự kiện cho ${newlyInvitedIds.length} người mới và ${reinvitedIds.length} người được mời lại`
            );
          } catch (notificationError) {
            console.error(
              'Lỗi khi gửi thông báo mời tham gia sự kiện (cập nhật):',
              notificationError
            );
          }
        });
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
            participants: updatedEvent.participants,
          }
        );
        console.log('Event updated on Google Calendar successfully');
      } catch (error) {
        console.warn('Failed to update Google Calendar event:', error.message);
      }
    }

    // Gửi thông báo real-time cho tất cả participants (trừ organizer)
    try {
      const organizerUser = await User.findById(req.user._id, 'username email');
      const participantsToNotify = updatedEvent.participants.filter(
        (p) =>
          p.userId.toString() !== req.user._id.toString() &&
          p.status === 'accepted'
      );

      if (participantsToNotify.length > 0) {
        for (const participant of participantsToNotify) {
          await NotificationService.createPersonalNotification({
            title: 'The event has been updated',
            content: `Your event "${event.title}" has been updated by ${organizerUser.username}.`,
            type: 'event_update',
            targetUserId: participant.userId,
            createdBy: req.user._id,
            relatedUserId: null,
            eventId: updatedEvent._id,
          });
        }
        console.log(
          `Đã gửi thông báo cập nhật sự kiện cho ${participantsToNotify.length} người tham gia`
        );
      }
    } catch (notificationError) {
      console.error(
        'Lỗi khi gửi thông báo cập nhật sự kiện:',
        notificationError
      );
      // Không làm gián đoạn quá trình cập nhật event
    }

    res.status(200).json({
      message: updatedEvent.googleEventId
        ? 'Successfully updated event and synced with Google Calendar'
        : 'Successfully updated event',
      status: 200,
      data: updatedEvent,
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      message: 'Error updating event',
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
        message: 'Missing event ID',
        status: 400,
      });
    }
    const event = await Event.findById(id);
    if (event.isDeleted) {
      return res.status(400).json({
        message: 'Event is already deleted before',
        status: 400,
      });
    }
    // Kiểm tra xem người dùng có phải là người tạo sự kiện không
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You do not have permission to delete this event',
        status: 403,
      });
    }

    // Kiểm tra trạng thái sự kiện có thể xóa không
    if (event.status === 'in-progress' || event.status === 'completed') {
      return res.status(400).json({
        message: 'You cannot delete an event that is in progress or completed',
        status: 400,
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

    res.status(200).json({
      message: 'Delete event successfully',
      status: 200,
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      message: 'Error deleting event',
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

    //Kiểm tra sự kiện còn tồn tại không
    if (!id) {
      return res.status(400).json({
        message: 'Missing event ID',
        status: 400,
      });
    }

    //Kiểm tra người được mời có tồn tại và có trong boardMembership hay không
    if (!email) {
      return res.status(400).json({
        message: 'Missing email of the invited user',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Event not found or has been deleted',
        status: 404,
      });
    }

    const invitedUser = await User.findOne({
      email: email,
      isDeleted: false,
    });

    if (!invitedUser) {
      return res.status(404).json({
        message: 'User not found with the provided email',
        status: 404,
      });
    }
    //Kiểm tra xem người dùng có đang mời chính mình vào sự kiện không
    if (event.organizer.toString() === invitedUser._id.toString()) {
      return res.status(400).json({
        message: 'You cannot invite yourself to an event',
        status: 400,
      });
    }

    //Kiểm tra invitedUser có trong boardMembership hay không
    const boardMembership = await BoardMembership.findOne({
      boardId: event.boardId,
      userId: invitedUser._id,
    });

    if (!boardMembership) {
      return res.status(403).json({
        message: 'User is not a member of the board associated with this event',
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
        message: 'User is already a participant of this event',
        status: 400,
      });
    } else if (
      existingParticipant &&
      boardMembership.invitationResponse === 'pending'
    ) {
      return res.status(400).json({
        message:
          'User is already invited to this event and is waiting for response',
        status: 400,
      });
    } else {
      // Kiểm tra xem người dùng có phải là người tạo sự kiện không
      if (event.organizer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message:
            'You do not have permission to invite participants to this event',
          status: 403,
        });
      }

      // Mời người dùng vào danh sách người tham gia sự kiện
      event.participants.push({
        userId: invitedUser._id,
        status: 'pending', // Trạng thái ban đầu là pending
      });
      await event.save();

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
          title: 'Invitation to join event',
          content: `You have been invited to join the event "${
            event.title
          }" by ${organizerUser.username || organizerUser.email}.`,
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
        message: 'Successfully invited user to the event',
        status: 200,
        data: event,
      });
    }
  } catch (error) {
    console.error('Error inviting user to event:', error);
    res.status(500).json({
      message: 'Error inviting user to event',
      status: 500,
      error: error.message,
    });
  }
};

//Accept - Decline an invitation to an event
exports.acceptOrDeclineParticipantStatus = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { status, forceAccept } = req.body;

    //Kiểm tra sự kiện có tồn tại không
    if (!id || !userId) {
      return res.status(400).json({
        message: 'Missing event ID or user ID',
        status: 400,
      });
    }

    //Kiểm tra người cập nhật trạng thái
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You do not have permission to update this status',
        status: 403,
      });
    }

    //Kiểm tra status có hợp lệ không
    if (!status || !['pending', 'accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        message:
          'Invalid status. Status must be "pending", "accepted", or "declined"',
        status: 400,
      });
    }

    //Kiểm tra sự kiện có tồn tại không
    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Event not found or has been deleted',
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
        message: 'User is not a participant of this event',
        status: 404,
      });
    }

    // Kiểm tra xung đột thời gian khi chấp nhận sự kiện
    if (status === 'accepted' && !forceAccept) {
      try {
        let allConflictingEvents = [];

        // BƯỚC 1: Chuẩn hóa thời gian cho sự kiện hiện tại
        const moment = require('moment-timezone');
        const timeZone = 'Asia/Ho_Chi_Minh';

        let currentEventStart, currentEventEnd;

        if (event.allDay) {
          // Đối với allDay events, chuẩn hóa về đầu và cuối ngày
          currentEventStart = moment
            .tz(event.startDate, timeZone)
            .startOf('day')
            .toDate();
          currentEventEnd = moment
            .tz(event.endDate, timeZone)
            .endOf('day')
            .toDate();
        } else {
          // Đối với normal events, giữ nguyên thời gian nhưng đảm bảo timezone
          currentEventStart = moment.tz(event.startDate, timeZone).toDate();
          currentEventEnd = moment.tz(event.endDate, timeZone).toDate();
        }

        // BƯỚC 2: Ưu tiên check sự kiện allDay trước
        if (event.allDay) {
          // Nếu sự kiện hiện tại là allDay, tìm tất cả allDay events trong cùng ngày
          const dayString = moment
            .tz(currentEventStart, timeZone)
            .format('YYYY-MM-DD');

          const allDayConflictQuery = {
            _id: { $ne: event._id },
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: userId,
                status: 'accepted',
              },
            },
            allDay: true,
            $expr: {
              $eq: [
                {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$startDate',
                    timezone: timeZone,
                  },
                },
                dayString,
              ],
            },
          };

          const allDayConflicts = await Event.find(allDayConflictQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...allDayConflicts);

          // Tìm normal events overlap với ngày allDay này
          const normalVsAllDayQuery = {
            _id: { $ne: event._id },
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: userId,
                status: 'accepted',
              },
            },
            allDay: { $ne: true },
            $and: [
              { startDate: { $lte: currentEventEnd } },
              { endDate: { $gte: currentEventStart } },
            ],
          };

          const normalConflicts = await Event.find(normalVsAllDayQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...normalConflicts);
        } else {
          // Nếu sự kiện hiện tại là normal event

          // Tìm allDay events trong các ngày liên quan
          const startDay = moment
            .tz(currentEventStart, timeZone)
            .format('YYYY-MM-DD');
          const endDay = moment
            .tz(currentEventEnd, timeZone)
            .format('YYYY-MM-DD');

          // Tạo danh sách ngày để check
          const dayStrings = [];
          const currentMoment = moment
            .tz(currentEventStart, timeZone)
            .startOf('day');
          const endMoment = moment.tz(currentEventEnd, timeZone).startOf('day');

          while (currentMoment.isSameOrBefore(endMoment, 'day')) {
            dayStrings.push(currentMoment.format('YYYY-MM-DD'));
            currentMoment.add(1, 'day');
          }

          const allDayVsNormalQuery = {
            _id: { $ne: event._id },
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: userId,
                status: 'accepted',
              },
            },
            allDay: true,
            $expr: {
              $in: [
                {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$startDate',
                    timezone: timeZone,
                  },
                },
                dayStrings,
              ],
            },
          };

          const allDayConflicts = await Event.find(allDayVsNormalQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...allDayConflicts);

          // Tìm normal events overlap về thời gian
          const normalVsNormalQuery = {
            _id: { $ne: event._id },
            isDeleted: false,
            status: { $nin: ['completed', 'cancelled'] },
            participants: {
              $elemMatch: {
                userId: userId,
                status: 'accepted',
              },
            },
            allDay: { $ne: true },
            startDate: { $lt: currentEventEnd },
            endDate: { $gt: currentEventStart },
          };

          const normalConflicts = await Event.find(normalVsNormalQuery)
            .populate('calendarId', 'name')
            .select('title startDate endDate calendarId allDay');

          allConflictingEvents.push(...normalConflicts);
        }

        // Loại bỏ duplicate events
        const conflictingEvents = allConflictingEvents.filter(
          (event, index, self) =>
            index ===
            self.findIndex((e) => e._id.toString() === event._id.toString())
        );

        if (conflictingEvents.length > 0) {
          // Có xung đột thời gian
          const conflictDetails = conflictingEvents.map((conflictEvent) => ({
            id: conflictEvent._id,
            title: conflictEvent.title,
            startDate: conflictEvent.startDate,
            endDate: conflictEvent.endDate,
            allDay: conflictEvent.allDay,
          }));

          return res.status(409).json({
            message:
              'You have an appointment within this time frame, so please consider carefully.',
            status: 409,
            hasConflict: true,
            conflictingEvents: conflictDetails,
            currentEvent: {
              id: event._id,
              title: event.title,
              startDate: currentEventStart,
              endDate: currentEventEnd,
              allDay: event.allDay,
            },
          });
        }
      } catch (conflictError) {
        console.error('Lỗi khi kiểm tra xung đột thời gian:', conflictError);
        // Không làm gián đoạn quá trình chấp nhận nếu có lỗi kiểm tra xung đột
      }
    }

    // Cập nhật trạng thái người tham gia
    const oldStatus = event.participants[participantIndex].status;
    event.participants[participantIndex].status = status;
    await event.save();

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
          // statusText = forceAccept
          //   ? 'đã chấp nhận (dù có xung đột thời gian)'
          //   : 'đã chấp nhận';
          statusText = 'accepted the invitation';

          break;
        case 'declined':
          statusText = 'declined the invitation';
          break;
        case 'pending':
          statusText = 'has considering to join';
          break;
        default:
          statusText = 'has updated event';
      }

      await NotificationService.createPersonalNotification({
        title: 'Response to event invitation',
        content: `${participantUser.username} ${statusText} "${event.title}".`,
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
      console.error('Error when sending notification:', notificationError);
      // Không làm gián đoạn quá trình cập nhật trạng thái
    }

    res.status(200).json({
      message: 'Updated participant status successfully',
      status: 200,
      data: event,
    });
  } catch (error) {
    console.error('Error when updating participant status:', error);
    res.status(500).json({
      message: 'Error when updating participant status',
      status: 500,
      error: error.message,
    });
  }
};

// Organizer removes a participant from an event
exports.removeParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;

    //Kiểm tra sự kiện có tồn tại không
    if (!id || !userId) {
      return res.status(400).json({
        message: 'Missing event ID or user ID',
        status: 400,
      });
    }

    //Kiểm tra người xóa có phải là người tạo sự kiện không
    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Event not found or has been deleted',
        status: 404,
      });
    }
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message:
          'You do not have permission to remove participants from this event',
        status: 403,
      });
    }
    // Kiểm tra xem người dùng có phải là người tham gia sự kiện không
    const participantIndex = event.participants.findIndex(
      (p) => p.userId.toString() === userId
    );
    if (participantIndex === -1) {
      return res.status(404).json({
        message: 'User is not a participant of this event',
        status: 404,
      });
    }

    //Xoá người tham gia khỏi sự kiện
    const removedParticipant = event.participants[participantIndex];
    event.participants.splice(participantIndex, 1);
    await event.save();

    res.status(200).json({
      message: 'Deleted participant successfully',
      status: 200,
      data: event,
    });
  } catch (error) {
    console.error('Error when removing participant:', error);
    res.status(500).json({
      message: 'Error when removing participant',
      status: 500,
      error: error.message,
    });
  }
};

//Cancel an invitation and give a reason
exports.cancelAnInvitationWhenAcceptBefore = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!id || !reason) {
      return res.status(400).json({
        message: 'Missing event ID or reason for cancellation',
        status: 400,
      });
    }

    // Find the event
    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Event not found or has been deleted',
        status: 404,
      });
    }

    // Check if user is a participant and has previously accepted
    const participantIndex = event.participants.findIndex(
      (p) =>
        p.userId.toString() === userId.toString() && p.status === 'accepted'
    );

    if (participantIndex === -1) {
      return res.status(403).json({
        message:
          'You are not a participant of this event or have not accepted the invitation',
        status: 403,
      });
    }

    // Check if event is not completed or cancelled
    if (['completed', 'cancelled'].includes(event.status)) {
      return res.status(400).json({
        message:
          'Cannot cancel an invitation for a completed or cancelled event',
        status: 400,
      });
    }

    // Check if event hasn't started yet
    const now = new Date();
    const eventStart = new Date(event.startDate);
    if (now >= eventStart) {
      return res.status(400).json({
        message:
          'Cannot cancel an invitation for an event that has already started',
        status: 400,
      });
    }

    // Get user info for system message
    const participantUser = await User.findById(
      userId,
      'username fullname email'
    );
    const participantName =
      participantUser.fullname ||
      participantUser.username ||
      participantUser.email;

    // Update participant status to declined and save reason
    event.participants[participantIndex].status = 'declined';
    event.participants[participantIndex].cancelReason = reason;
    event.participants[participantIndex].cancelledAt = new Date();

    await event.save();

    // ✨ CREATE SYSTEM MESSAGE IN CHAT BOX
    try {
      const { getAdminId } = require('../utils/admin');
      const Message = require('../models/messageModel');
      const { getIO } = require('../utils/socket');

      // Create system message with adminId as sender
      const adminId = getAdminId();
      const systemMessageContent = `📢 ${participantName} cancelled to join this event with reason: "${reason}"`;

      const systemMessage = await Message.create({
        eventId: event._id,
        userId: adminId,
        content: systemMessageContent,
        isSystemMessage: true, // Đánh dấu đây là system message (nếu cần thêm field này vào schema)
      });

      // Populate admin info
      await systemMessage.populate('userId', 'fullname username avatar');

      // Send real-time message to all participants in chat
      const io = getIO();
      let realtimeTargets = [];

      // Get all participants who should receive the message
      if (event.boardId) {
        // If event belongs to board, send to board members
        const BoardMembership = require('../models/boardMembershipModel');
        const boardMembers = await BoardMembership.find({
          boardId: event.boardId,
          applicationStatus: 'accepted',
          isDeleted: false,
        });
        realtimeTargets = boardMembers.map((member) =>
          member.userId.toString()
        );
      } else {
        // For regular events, send to all accepted participants and organizer
        realtimeTargets = event.participants
          .filter((p) => p.status === 'accepted')
          .map((p) => p.userId.toString());

        // Add organizer if not already included
        if (!realtimeTargets.includes(event.organizer.toString())) {
          realtimeTargets.push(event.organizer.toString());
        }
      }

      console.log(
        `📢 Gửi system message về việc hủy tham gia tới ${realtimeTargets.length} người`
      );

      // Emit system message to all participants
      realtimeTargets.forEach((participantId) => {
        io.to(participantId).emit('new_event_message', {
          eventId: event._id,
          message: {
            _id: systemMessage._id,
            content: systemMessage.content,
            userId: {
              _id: systemMessage.userId._id,
              fullname: systemMessage.userId.fullname,
              username: systemMessage.userId.username,
              avatar: systemMessage.userId.avatar,
            },
            createdAt: systemMessage.createdAt,
            isSystemMessage: true,
          },
        });
      });

      console.log(
        `✅ Đã tạo system message về việc hủy tham gia: ${systemMessageContent}`
      );
    } catch (systemMessageError) {
      console.error('❌ Lỗi khi tạo system message:', systemMessageError);
      // Don't fail the main operation if system message creation fails
    }

    // Send notification to event organizer and other accepted participants
    try {
      const formattedEventStartDate = formatDateToTimeZone(
        event.startDate,
        event.timeZone || 'Asia/Ho_Chi_Minh'
      );

      // Get all accepted participants except the one who is cancelling
      const acceptedParticipants = event.participants.filter(
        (p) =>
          p.status === 'accepted' && p.userId.toString() !== userId.toString()
      );

      // First, notify the organizer with a special message
      await NotificationService.createPersonalNotification({
        title: 'A participant has cancelled to join event',
        content: `${participantName} has cancelled to join event "${
          event.title
        }" with : ${reason.substring(0, 100)}...`,
        type: 'event_cancellation',
        targetUserId: event.organizer,
        createdBy: userId,
        relatedUserId: userId,
        eventId: event._id,
      });

      // Then, notify all other accepted participants
      for (const participant of acceptedParticipants) {
        // Skip if participant is the organizer (already notified)
        if (participant.userId.toString() === event.organizer.toString()) {
          continue;
        }

        await NotificationService.createPersonalNotification({
          title: 'Notification of event cancellation',
          content: `${participantName} has cancelled to join event "${event.title}"`,
          type: 'event_participant_cancelled',
          targetUserId: participant.userId,
          createdBy: userId,
          relatedUserId: userId,
          eventId: event._id,
        });
      }

      console.log(
        `Đã gửi thông báo hủy tham gia sự kiện cho organizer ${event.organizer} và ${acceptedParticipants.length} người tham gia khác`
      );
    } catch (notificationError) {
      console.error(
        'Lỗi khi gửi thông báo hủy tham gia sự kiện:',
        notificationError
      );
      // Don't throw error, continue with the cancellation process
    }

    // If event has Google Calendar sync, update it
    if (event.googleEventId) {
      try {
        await updateGoogleCalendarEvent(event.organizer, event.googleEventId, {
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          allDay: event.allDay,
          type: event.type,
          locationName: event.locationName,
          address: event.address,
          onlineUrl: event.onlineUrl,
          timeZone: event.timeZone,
          participants: event.participants,
        });
        console.log('Event updated on Google Calendar successfully');
      } catch (error) {
        console.warn('Failed to update Google Calendar event:', error.message);
      }
    }

    res.status(200).json({
      message: 'Cancelled participation successfully',
      status: 200,
      data: {
        eventId: event._id,
        userId: userId,
        status: 'declined',
        reason: reason,
        cancelledAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error while cancelling participation:', error);
    res.status(500).json({
      message: 'Error while cancelling participation',
      status: 500,
      error: error.message,
    });
  }
};

// Cập nhật trạng thái tất cả sự kiện liên quan đến user dựa trên thời gian
exports.updateAllUserEventsStatusByTime = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // Lấy tất cả sự kiện mà user có liên quan (organizer hoặc participant)
    // Chỉ lấy sự kiện chưa bị xóa và có status không phải 'cancelled' hoặc 'completed'
    const userEvents = await Event.find({
      $and: [
        { isDeleted: false },
        // { status: { $ne: 'cancelled' } },
        // Không cập nhật sự kiện đã hủy hoặc đã hoàn thành
        {
          status: { $nin: ['cancelled', 'completed'] }, // Chỉ cập nhật sự kiện chưa hủy hoặc đã hoàn thành
        },
        {
          $or: [
            { organizer: userId }, // Sự kiện do user tạo
            {
              participants: {
                $elemMatch: {
                  userId: userId,
                  status: { $in: ['accepted', 'pending'] }, // Chỉ cập nhật sự kiện user đã tham gia hoặc đang chờ
                },
              },
            },
          ],
        },
      ],
    }).select('title startDate endDate status allDay organizer participants');

    if (userEvents.length === 0) {
      console.log(
        `Không có sự kiện nào cần cập nhật trạng thái cho user ${userId}`
      );
      return res.status(200).json({
        message: 'There are no events to update status for user',
        status: 200,
        data: {
          totalEvents: 0,
          updatedEvents: 0,
          events: [],
        },
      });
    }

    // Phân loại và cập nhật sự kiện theo batch
    const eventsToUpdate = [];
    const eventUpdates = [];

    for (const event of userEvents) {
      const newStatus = determineEventStatus(
        event.startDate,
        event.endDate,
        event.status
      );

      if (newStatus !== event.status) {
        eventsToUpdate.push({
          eventId: event._id,
          oldStatus: event.status,
          newStatus: newStatus,
          title: event.title,
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
      }
    }

    let updatedCount = 0;

    // Thực hiện batch update nếu có sự kiện cần cập nhật
    if (eventUpdates.length > 0) {
      try {
        const bulkResult = await Event.bulkWrite(eventUpdates, {
          ordered: false,
        });
        updatedCount = bulkResult.modifiedCount;

        // Tạo event history records cho những sự kiện đã được cập nhật
        for (const eventUpdate of eventsToUpdate) {
          const event = userEvents.find(
            (e) => e._id.toString() === eventUpdate.eventId.toString()
          );
        }

        console.log(
          `✅ Bulk updated ${updatedCount} events status for user ${userId}`
        );

        // Gửi thông báo real-time cho user qua socket
        try {
          const { emitToUser } = require('../utils/socket');
          emitToUser(userId.toString(), 'events_status_updated', {
            updatedCount,
            events: eventsToUpdate,
          });
        } catch (socketError) {
          console.warn('Failed to emit socket event:', socketError.message);
        }
      } catch (bulkError) {
        console.error('❌ Bulk update failed:', bulkError);
        return res.status(500).json({
          message: 'Error updating event statuses in bulk',
          status: 500,
          error: bulkError.message,
        });
      }
    }
    console.log(
      `✅ Đã cập nhật ${updatedCount} trạng thái sự kiện cho ${userId}`
    );

    res.status(200).json({
      message:
        updatedCount > 0
          ? `Đã cập nhật trạng thái cho ${updatedCount} sự kiện`
          : 'Tất cả sự kiện đã có trạng thái chính xác',
      status: 200,
      data: {
        totalEvents: userEvents.length,
        updatedEvents: updatedCount,
        events: eventsToUpdate,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật trạng thái sự kiện hàng loạt:', error);
    res.status(500).json({
      message: 'Lỗi máy chủ',
      status: 500,
      error: error.message,
    });
  }
};

// Cập nhật trạng thái sự kiện dựa trên thời gian (legacy - giữ lại để backward compatibility)
exports.updateEventStatusByTime = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: 'Event ID is required',
        status: 400,
      });
    }

    const event = await Event.findById(id);
    if (!event || event.isDeleted) {
      return res.status(404).json({
        message: 'Event not found or has been deleted',
        status: 404,
      });
    }

    // Kiểm tra quyền truy cập - user phải là participant hoặc organizer
    const userId = req.user._id;
    const isParticipant = event.participants.some(
      (p) => p.userId.toString() === userId.toString()
    );
    const isOrganizer = event.organizer.toString() === userId.toString();

    if (!isParticipant && !isOrganizer) {
      return res.status(403).json({
        message: 'You do not have permission to update this event',
        status: 403,
      });
    }

    // Xác định trạng thái mới dựa trên thời gian
    const newStatus = determineEventStatus(
      event.startDate,
      event.endDate,
      event.status,
      event.allDay
    );

    let updated = false;
    // Chỉ cập nhật nếu trạng thái thực sự thay đổi
    if (newStatus !== event.status) {
      const oldStatus = event.status;
      event.status = newStatus;
      event.updatedAt = new Date();
      await event.save();
      updated = true;

      console.log(
        `✅ Auto-updated event ${event._id} status from ${oldStatus} to ${newStatus}`
      );

      // Emit socket event for real-time update
      try {
        const { emitToUser } = require('../utils/socket');
        emitToUser(userId.toString(), 'event_status_updated', {
          eventId: event._id,
          oldStatus,
          newStatus,
          title: event.title,
        });
      } catch (socketError) {
        console.warn('Failed to emit socket event:', socketError.message);
      }
    }

    res.status(200).json({
      message: 'Event status updated successfully',
      status: 200,
      data: {
        eventId: event._id,
        oldStatus: event.status,
        newStatus: newStatus,
        updated: updated,
      },
    });
  } catch (error) {
    console.error('❌ Error updating event status:', error);
    res.status(500).json({
      message: 'Error updating event status',
      status: 500,
      error: error.message,
    });
  }
};
