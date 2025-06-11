const { SpacesServiceClient } = require('@google-apps/meet').v2;
const { authorize } = require('../utils/googleAuthUtils');
const AppError = require('../utils/appError');
const { google } = require('googleapis');

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

    console.log('Creating Meet space for user:', userId);

    // Sử dụng Calendar API để tạo event với Meet link (most reliable) (thay vì google meet API)
    try {
      console.log('Trying Calendar API method...');
      const calendarAuthClient = await authorize(
        userId,
        'calendar',
        CALENDAR_SCOPES
      );
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
              Math.random().toString(36).substring(2, 9),
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
          'Successfully created Meet link via Calendar API:',
          meetLink
        );
        return meetLink;
      } else {
        console.log('No Meet link found in Calendar API response');
      }
    } catch (calendarError) {
      console.log('Calendar API failed:', calendarError.message);
    }

    // Nếu tất cả methods đều fail
    throw new AppError(
      'Không thể tạo link Meet hợp lệ. Vui lòng kiểm tra quyền truy cập Google APIs.',
      500
    );
  } catch (error) {
    console.error('Chi tiết lỗi khi tạo Meet space:', error);

    // Nếu là lỗi authentication, ném lỗi để user phải auth lại
    if (error.statusCode === 401) {
      throw error;
    }

    // Với các lỗi khác, throw error với thông tin chi tiết
    throw new AppError(`Không thể tạo link Meet: ${error.message}`, 500);
  }
};
