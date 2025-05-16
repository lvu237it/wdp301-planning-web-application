const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// Định nghĩa SCOPES (quyền đầy đủ để thêm/sửa sự kiện)
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Đường dẫn tới file credentials và token
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Đọc token đã lưu từ token.json nếu tồn tại
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.log('Error loading saved credentials:', err.message);
    return null;
  }
}

/**
 * Lưu token vào token.json
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
    console.log('Credentials saved to token.json');
  } catch (err) {
    console.error('Error saving credentials:', err.message);
    throw err;
  }
}

/**
 * Xác thực với Google OAuth 2.0
 * @return {Promise<OAuth2Client>}
 */
async function authorize() {
  console.log('Starting authorization...');
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    console.log('Using existing token from token.json');
    return client;
  }
  console.log('Authenticating with Google...');
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
    redirect_uri: 'http://localhost:8080/auth/google/callback', // Chỉ định rõ redirect_uri
  });
  if (client.credentials) {
    console.log('Authorization successful, saving credentials...');
    await saveCredentials(client);
  }
  return client;
}

/**
 * Thêm sự kiện vào Google Calendar
 * @param {Object} eventData - Dữ liệu sự kiện (title, location, startDate, endDate)
 * @param {google.auth.OAuth2} auth - Đối tượng xác thực
 * @return {Promise<Object>}
 */
async function addEvent(auth, eventData) {
  const calendar = google.calendar({ version: 'v3', auth });
  const event = {
    summary: eventData.title,
    location: eventData.location,
    description: eventData.description || 'Sự kiện từ ứng dụng',
    start: {
      dateTime: eventData.startDate,
      timeZone: 'Asia/Ho_Chi_Minh',
    },
    end: {
      dateTime: eventData.endDate,
      timeZone: 'Asia/Ho_Chi_Minh',
    },
  };

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    console.log('Event added to Google Calendar:', res.data.htmlLink);
    return { success: true, event: res.data, htmlLink: res.data.htmlLink };
  } catch (error) {
    console.error('Error adding event:', error.message);
    throw new Error(`Lỗi thêm sự kiện: ${error.message}`);
  }
}

/**
 * Controller để xử lý yêu cầu thêm sự kiện từ frontend
 * @param {Object} req - Yêu cầu từ client
 * @param {Object} res - Phản hồi từ server
 * @param {Function} next - Middleware xử lý lỗi
 */
exports.addCalendarEvent = async (req, res, next) => {
  try {
    const auth = await authorize();
    const eventData = req.body; // Dữ liệu từ frontend (title, location, startDate, endDate)
    const result = await addEvent(auth, eventData);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Error in addCalendarEvent:', error.message);
    next(error); // Sử dụng middleware lỗi của bạn (AppError)
  }
};

// const fs = require('fs').promises;
// const path = require('path');
// const process = require('process');
// const { authenticate } = require('@google-cloud/local-auth');
// const { google } = require('googleapis');
// const Event = require('../models/eventModel'); // Import model Event
// const GoogleToken = require('../models/googleTokenModel'); // Import model GoogleToken

// // Định nghĩa SCOPES
// const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// // Đường dẫn tới file credentials
// const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// /**
//  * Load saved credentials from MongoDB if they exist
//  * @param {String} userId - ID of the user
//  * @return {Promise<OAuth2Client|null>}
//  */
// async function loadSavedCredentialsIfExist(userId) {
//   try {
//     const tokenDoc = await GoogleToken.findOne({ userId });
//     if (tokenDoc) {
//       const credentials = {
//         type: 'authorized_user',
//         client_id: process.env.GOOGLE_CLIENT_ID, // Thêm vào .env
//         client_secret: process.env.GOOGLE_CLIENT_SECRET, // Thêm vào .env
//         refresh_token: tokenDoc.refreshToken,
//       };
//       const client = google.auth.fromJSON(credentials);
//       client.setCredentials({
//         access_token: tokenDoc.accessToken,
//         expiry_date: tokenDoc.expiryDate,
//       });
//       return client;
//     }
//     return null;
//   } catch (err) {
//     console.log('Error loading saved credentials:', err.message);
//     return null;
//   }
// }

// /**
//  * Save credentials to MongoDB
//  * @param {OAuth2Client} client - OAuth2 client
//  * @param {String} userId - ID of the user
//  * @return {Promise<void>}
//  */
// async function saveCredentials(client, userId) {
//   try {
//     await GoogleToken.findOneAndUpdate(
//       { userId },
//       {
//         userId,
//         accessToken: client.credentials.access_token,
//         refreshToken: client.credentials.refresh_token,
//         expiryDate: client.credentials.expiry_date,
//         updatedAt: Date.now(),
//       },
//       { upsert: true, new: true }
//     );
//     console.log('Credentials saved to MongoDB for user:', userId);
//   } catch (err) {
//     console.error('Error saving credentials:', err.message);
//     throw err;
//   }
// }

// /**
//  * Authorize with Google OAuth 2.0
//  * @param {String} userId - ID of the user
//  * @return {Promise<OAuth2Client>}
//  */
// async function authorize(userId) {
//   console.log('Starting authorization...');
//   let client = await loadSavedCredentialsIfExist(userId);
//   if (client) {
//     console.log('Using existing token from MongoDB');
//     return client;
//   }
//   console.log('Authenticating with Google...');
//   client = await authenticate({
//     scopes: SCOPES,
//     keyfilePath: CREDENTIALS_PATH,
//     redirect_uri: 'http://localhost:3000/auth/google/callback',
//   });
//   if (client.credentials) {
//     console.log('Authorization successful, saving credentials...');
//     await saveCredentials(client, userId);
//   }
//   return client;
// }

// /**
//  * Add event to Google Calendar and save to MongoDB
//  * @param {Object} auth - OAuth2 client
//  * @param {Object} eventData - Event data (title, location, startDate, endDate)
//  * @param {String} userId - ID of the user
//  * @return {Promise<Object>}
//  */
// async function addEvent(auth, eventData, userId) {
//   const calendar = google.calendar({ version: 'v3', auth });
//   const event = {
//     summary: eventData.title,
//     location: eventData.location,
//     description: eventData.description || 'Sự kiện từ ứng dụng',
//     start: {
//       dateTime: eventData.startDate,
//       timeZone: 'Asia/Ho_Chi_Minh',
//     },
//     end: {
//       dateTime: eventData.endDate,
//       timeZone: 'Asia/Ho_Chi_Minh',
//     },
//   };

//   try {
//     const res = await calendar.events.insert({
//       calendarId: 'primary',
//       resource: event,
//     });

//     // Save event to MongoDB
//     const savedEvent = await Event.create({
//       title: eventData.title,
//       location: eventData.location,
//       description: eventData.description,
//       startDate: eventData.startDate,
//       endDate: eventData.endDate,
//       userId,
//       googleEventId: res.data.id,
//       googleCalendarId: 'primary',
//     });

//     console.log('Event added to Google Calendar:', res.data.htmlLink);
//     return { success: true, event: res.data, htmlLink: res.data.htmlLink, localEvent: savedEvent };
//   } catch (error) {
//     console.error('Error adding event:', error.message);
//     throw new Error(`Lỗi thêm sự kiện: ${error.message}`);
//   }
// }

// /**
//  * Controller to handle adding event from frontend
//  * @param {Object} req - Request from client
//  * @param {Object} res - Response from server
//  * @param {Function} next - Error handling middleware
//  */
// exports.addCalendarEvent = async (req, res, next) => {
//   try {
//     // Giả định bạn đã có userId từ session hoặc token JWT
//     const userId = req.user ? req.user._id : 'TEMP_USER_ID'; // Thay thế bằng logic xác thực người dùng
//     const auth = await authorize(userId);
//     const eventData = req.body; // Data from frontend (title, location, startDate, endDate)
//     const result = await addEvent(auth, eventData, userId);
//     res.status(200).json({
//       status: 'success',
//       data: result,
//     });
//   } catch (error) {
//     console.error('Error in addCalendarEvent:', error.message);
//     next(error);
//   }
// };
