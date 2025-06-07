const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const GoogleToken = require('../models/googleTokenModel');
const AppError = require('../utils/appError');

// Định nghĩa scope cho Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Load token từ MongoDB nếu đã tồn tại
 * @param {String} userId - ID của người dùng
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist(userId) {
  try {
    const tokenDoc = await GoogleToken.findOne({ userId });
    if (tokenDoc) {
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      client.setCredentials({
        access_token: tokenDoc.accessToken,
        refresh_token: tokenDoc.refreshToken,
        expiry_date: tokenDoc.expiryDate,
      });
      return client;
    }
    return null;
  } catch (err) {
    console.error('Lỗi khi load token:', err.message);
    return null;
  }
}

/**
 * Lưu token vào MongoDB
 * @param {OAuth2Client} client - Đối tượng OAuth2
 * @param {String} userId - ID của người dùng
 * @return {Promise<void>}
 */
async function saveCredentials(client, userId) {
  try {
    if (!userId) {
      throw new AppError('Không tìm thấy userId để lưu token', 400);
    }
    await GoogleToken.findOneAndUpdate(
      { userId },
      {
        userId,
        accessToken: client.credentials.access_token,
        refreshToken: client.credentials.refresh_token,
        expiryDate: client.credentials.expiry_date,
        updatedAt: Date.now(),
      },
      { upsert: true, new: true }
    );
    console.log('Đã lưu token vào MongoDB cho người dùng:', userId);
  } catch (err) {
    console.error('Lỗi khi lưu token:', err.message);
    throw err;
  }
}

/**
 * Xác thực với Google OAuth 2.0
 * @param {String} userId - ID của người dùng
 * @return {Promise<OAuth2Client>}
 */
async function authorize(userId) {
  let client = await loadSavedCredentialsIfExist(userId);
  if (client) {
    console.log('Sử dụng token đã lưu từ MongoDB');
    return client;
  }

  client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  throw new AppError('Cần xác thực. Vui lòng truy cập: ' + authUrl, 401);
}

/**
 * Lấy URL xác thực Google cho frontend
 */
exports.getGoogleAuthUrl = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(new AppError('Người dùng chưa đăng nhập', 401));
    }
    const userId = req.user._id;
    console.log('getGoogleAuthUrl - userId:', userId); // Debug

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Tạo state là JWT chứa userId
    const state = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: '10m',
    });
    console.log('getGoogleAuthUrl - state:', state); // Debug

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state,
    });

    res.status(200).json({
      status: 'success',
      data: { authUrl },
    });
  } catch (error) {
    console.error('Lỗi khi tạo URL xác thực:', error.message);
    next(new AppError('Không thể tạo URL xác thực: ' + error.message, 500));
  }
};

/**
 * Xử lý callback từ Google OAuth
 */
exports.handleGoogleAuthCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    console.log('handleGoogleAuthCallback - code:', code); // Debug
    console.log('handleGoogleAuthCallback - state:', state); // Debug
    console.log('handleGoogleAuthCallback - req.user:', req.user); // Debug

    if (!code) {
      return next(new AppError('Không nhận được mã xác thực', 400));
    }
    if (!state) {
      return next(new AppError('State không hợp lệ', 400));
    }

    // Xác minh state là JWT chứa userId
    let userId;
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      console.log('handleGoogleAuthCallback - decoded:', decoded); // Debug
      userId = decoded.userId;
      if (!userId) {
        return next(new AppError('userId không hợp lệ trong state', 400));
      }
    } catch (error) {
      console.error('Lỗi xác minh state:', error.message);
      return next(new AppError('State không hợp lệ hoặc đã bị thay đổi', 400));
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    await saveCredentials(client, userId);

    res.status(200).json({
      status: 'success',
      message:
        'Xác thực Google Drive thành công. Bạn có thể sử dụng các tính năng Google Drive.',
    });
  } catch (error) {
    console.error('Lỗi trong handleGoogleAuthCallback:', error.message);
    const errorMessage = req.query.error
      ? decodeURIComponent(req.query.error)
      : 'Lỗi xác thực Google Drive không xác định';
    res.status(400).json({
      status: 'error',
      message: errorMessage,
    });
  }
};

/**
 * Tải file lên Google Drive
 */
exports.uploadFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const file = req.file;
    if (!file) {
      return next(new AppError('Chưa chọn file để tải lên', 400));
    }

    const auth = await authorize(userId);
    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: file.originalname,
      parents: ['root'],
    };
    const media = {
      mimeType: file.mimetype,
      body: require('fs').createReadStream(file.path),
    };

    const { data } = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: ['id', 'name', 'webViewLink'],
    });

    await fs.unlink(file.path);

    res.status(200).json({
      status: 'success',
      data: {
        fileId: data.id,
        fileName: data.name,
        webViewLink: data.webViewLink,
      },
    });
  } catch (error) {
    console.error('Lỗi khi tải file lên:', error.message);
    next(new AppError('Tải file thất bại: ' + error.message, 500));
  }
};

/**
 * Liệt kê file trong Google Drive
 */
exports.listFiles = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const auth = await authorize(userId);
    const drive = google.drive({ version: 'v3', auth });

    const { data } = await drive.files.list({
      pageSize: 10,
      fields: 'files(id, name, mimeType, webViewLink)',
    });

    res.status(200).json({
      status: 'success',
      data: data.files,
    });
  } catch (error) {
    console.error('Lỗi khi liệt kê file:', error.message);
    next(new AppError('Liệt kê file thất bại: ' + error.message, 500));
  }
};

/**
 * Xóa file khỏi Google Drive
 */
exports.deleteFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileId } = req.params;
    const auth = await authorize(userId);
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.delete({ fileId });

    res.status(200).json({
      status: 'success',
      message: 'Xóa file thành công',
    });
  } catch (error) {
    console.error('Lỗi khi xóa file:', error.message);
    next(new AppError('Xóa file thất bại: ' + error.message, 500));
  }
};
