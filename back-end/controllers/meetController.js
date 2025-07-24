const { SpacesServiceClient } = require('@google-apps/meet').v2;
const { authorize } = require('../utils/googleAuthUtils');
const AppError = require('../utils/appError');
const { google } = require('googleapis');
const crypto = require('crypto');

const MEET_SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];

exports.createMeetSpace = async (
  req,
  service = 'meet',
  scopes = MEET_SCOPES
) => {
  try {
    const userId = req.user._id;
    if (!userId) throw new AppError('Người dùng chưa đăng nhập', 401);
    console.log(
      '[meetController.js][createMeetSpace] Bắt đầu tạo link Google Meet cho user:',
      userId
    );
    let calendarAuthClient;
    try {
      calendarAuthClient = await authorize(userId, 'calendar', CALENDAR_SCOPES);
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
    const calendar = google.calendar({
      version: 'v3',
      auth: calendarAuthClient,
    });

    // Tạo một temporary calendar event với Meet link
    const tempEvent = {
      summary: 'Meeting - ' + new Date().toISOString(),
      start: {
        dateTime: new Date().toISOString(),
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      conferenceData: {
        createRequest: {
          requestId:
            'meet-' +
            Date.now() +
            '-' +
            // Math.random().toString(36).substring(2, 9),
            crypto.randomBytes(4).toString('hex'),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
      attendees: [],
    };

    console.log('Creating calendar event with conference data...');
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      resource: tempEvent,
      conferenceDataVersion: 1,
    });

    console.log('Calendar event created:', data.id);

    // Extract Meet link
    let meetLink = null;
    if (data.conferenceData && data.conferenceData.entryPoints) {
      const meetEntry = data.conferenceData.entryPoints.find(
        (entry) => entry.entryPointType === 'video'
      );
      if (meetEntry && meetEntry.uri) {
        meetLink = meetEntry.uri;
        console.log('Meet link extracted:', meetLink);
      }
    }

    // Clean up temporary event after a short delay
    if (data.id) {
      setTimeout(() => {
        calendar.events
          .delete({
            calendarId: 'primary',
            eventId: data.id,
          })
          .catch((err) =>
            console.log('Failed to delete temp event:', err.message)
          );
      }, 5000); // Chờ 5 giây trước khi xóa
    }

    if (meetLink) {
      console.log(
        '[meetController.js][createMeetSpace] Đã tạo link Google Meet:',
        meetLink
      );
      return meetLink;
    } else {
      console.log('No Meet link found in Calendar API response');
    }
  } catch (error) {
    console.error(
      '[meetController.js][createMeetSpace] Lỗi tạo link Google Meet:',
      error.message
    );
    throw error;
  }
};
