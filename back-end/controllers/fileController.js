const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const GoogleToken = require('../models/googleTokenModel');
const AppError = require('../utils/appError');
const {
  authorize,
  saveCredentials,
  getCombinedAuthUrl,
} = require('../utils/googleAuthUtils');

const SERVICE_SCOPES = {
  drive: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
  meet: ['https://www.googleapis.com/auth/meetings.space.created'],
  calendar: ['https://www.googleapis.com/auth/calendar'],
};

const DRIVE_SCOPES = SERVICE_SCOPES.drive;

exports.getGoogleAuthUrl = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(new AppError('Người dùng chưa đăng nhập', 401));
    }
    const userId = req.user._id;
    const services = ['drive', 'meet', 'calendar'];

    const authUrl = await getCombinedAuthUrl(userId, services);
    if (!authUrl) {
      return res.status(200).json({
        status: 'success',
        message: 'Đã có tất cả scopes cần thiết',
      });
    }

    const state = jwt.sign({ userId, services }, process.env.JWT_SECRET, {
      expiresIn: '10m',
    });
    console.log('getGoogleAuthUrl - created state:', state);

    const urlWithState = new URL(authUrl);
    urlWithState.searchParams.set('state', state);

    res.status(200).json({
      status: 'success',
      data: { authUrl: urlWithState.toString() },
    });
  } catch (error) {
    console.error('Lỗi khi tạo URL xác thực:', error.message);
    next(new AppError('Không thể tạo URL xác thực: ' + error.message, 500));
  }
};

exports.checkGoogleAuth = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const services = ['drive', 'meet', 'calendar'];
    const tokens = await GoogleToken.find({
      userId,
      service: { $in: services },
      status: 'active',
    });

    const requiredScopes = services.flatMap(
      (service) => SERVICE_SCOPES[service] || []
    );
    const existingScopes = tokens.flatMap((token) => token.scopes);
    const missingScopes = requiredScopes.filter(
      (scope) => !existingScopes.includes(scope)
    );

    if (missingScopes.length === 0) {
      res
        .status(200)
        .json({ status: 'success', message: 'Đã xác thực tất cả dịch vụ' });
    } else {
      res
        .status(401)
        .json({ status: 'error', message: 'Chưa xác thực đầy đủ các dịch vụ' });
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra xác thực:', error.message);
    next(new AppError('Lỗi khi kiểm tra xác thực: ' + error.message, 500));
  }
};

exports.handleGoogleAuthCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    console.log('handleGoogleAuthCallback - code:', code);
    console.log('handleGoogleAuthCallback - raw state:', state);

    if (!code || !state) {
      return next(new AppError('Mã xác thực hoặc state không hợp lệ', 400));
    }

    let decoded;
    try {
      const decodedState = decodeURIComponent(state);
      console.log('handleGoogleAuthCallback - decoded state:', decodedState);

      decoded = jwt.verify(decodedState, process.env.JWT_SECRET);
      console.log('handleGoogleAuthCallback - verified state:', decoded);

      if (!decoded.userId || !decoded.services) {
        return next(new AppError('State không hợp lệ', 400));
      }
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return next(new AppError('State không hợp lệ hoặc đã bị thay đổi', 400));
    }

    const { userId, services } = decoded;
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Lưu token cho từng dịch vụ với scope riêng biệt
    for (const service of services) {
      const scopes = SERVICE_SCOPES[service] || [];
      if (scopes.length > 0) {
        await saveCredentials(client, userId, service, scopes);
        console.log(`Đã lưu token cho dịch vụ: ${service}`);
      }
    }

    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  } catch (error) {
    console.error('Lỗi trong handleGoogleAuthCallback:', error.message);
    const errorMessage = req.query.error
      ? decodeURIComponent(req.query.error)
      : 'Lỗi xác thực Google không xác định';
    res.status(400).json({
      status: 'error',
      message: errorMessage,
    });
  }
};

exports.uploadFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const file = req.file;
    if (!file) {
      return next(new AppError('Chưa chọn file để tải lên', 400));
    }

    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: file.originalname,
      parents: ['root'],
    };
    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.path),
    };

    const { data } = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, webViewLink',
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

exports.listFiles = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
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

exports.deleteFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileId } = req.params;
    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
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
