const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const GoogleToken = require('../models/googleTokenModel');
const Task = require('../models/taskModel');
const File = require('../models/fileModel');
const AppError = require('../utils/appError');
const {
  authorize,
  saveCredentials,
  getCombinedAuthUrl,
} = require('../utils/googleAuthUtils');
const NotificationService = require('../services/NotificationService');
const { getAdminId } = require('../utils/admin');
const { createContentDispositionHeader } = require('../utils/fileUtils');
const ActivityLog = require('../models/activityLogModel');
const { formatDateToTimeZone } = require('../utils/dateUtils');
const { emitToBoard, emitToUser } = require('../utils/socket');

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
    console.error('Error getting Google auth URL:', error.message);
    next(new AppError('Error getting Google auth URL: ' + error.message, 500));
  }
};

exports.checkGoogleAuth = async (req, res, next) => {
  try {
    const userId = req.user._id;
    console.log('userId', userId);
    const services = ['drive', 'meet', 'calendar'];

    console.log(`🔍 Checking Google auth for user: ${userId}`);

    const tokens = await GoogleToken.find({
      userId,
      service: { $in: services },
      status: 'active',
    });

    console.log(`📊 Found ${tokens.length} tokens for user`);

    // Log detailed token expiry information
    tokens.forEach((token) => {
      const now = Date.now();
      const expiryDate = token.expiryDate;
      const timeUntilExpiry = expiryDate ? expiryDate - now : null;
      const hoursUntilExpiry = timeUntilExpiry
        ? Math.round(timeUntilExpiry / (1000 * 60 * 60))
        : null;

      console.log(`
🔐 Token for service: ${token.service}
   Status: ${token.status}
   Expiry date: ${
     expiryDate ? new Date(expiryDate).toLocaleString() : 'No expiry set'
   }
   Time until expiry: ${hoursUntilExpiry ? `${hoursUntilExpiry} hours` : 'N/A'}
   Has refresh token: ${token.refreshToken ? 'Yes' : 'No'}
   Scopes: ${token.scopes.join(', ')}
      `);
    });

    const requiredScopes = services.flatMap(
      (service) => SERVICE_SCOPES[service] || []
    );
    const existingScopes = tokens.flatMap((token) => token.scopes);
    const missingScopes = requiredScopes.filter(
      (scope) => !existingScopes.includes(scope)
    );

    // Check token expiry and try to refresh if possible
    const validTokens = [];
    const expiredTokens = [];
    const refreshFailedTokens = [];

    for (const token of tokens) {
      if (!token.expiryDate || token.expiryDate > Date.now()) {
        validTokens.push(token);
        continue;
      }

      if (!token.refreshToken) {
        expiredTokens.push(token);
        continue;
      }

      try {
        const client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        client.setCredentials({
          refresh_token: token.refreshToken,
        });

        const { credentials } = await client.refreshAccessToken();

        // Update token in database
        await GoogleToken.updateOne(
          { _id: token._id },
          {
            accessToken: credentials.access_token,
            expiryDate: credentials.expiry_date,
            status: 'active',
            updatedAt: Date.now(),
          }
        );

        validTokens.push({
          ...token.toObject(),
          accessToken: credentials.access_token,
          expiryDate: credentials.expiry_date,
        });
      } catch (error) {
        console.error(
          `Failed to refresh token for service ${token.service}:`,
          error
        );
        refreshFailedTokens.push(token);

        // Mark token as expired
        await GoogleToken.updateOne({ _id: token._id }, { status: 'expired' });
      }
    }

    const existingTokensCount = tokens.length;
    const needsReauth =
      expiredTokens.length > 0 || refreshFailedTokens.length > 0;

    console.log(
      `🔍 Missing scopes: ${missingScopes.length}, Valid tokens: ${validTokens.length}, ` +
        `Expired tokens: ${expiredTokens.length}, Refresh failed: ${refreshFailedTokens.length}, ` +
        `Required services: ${services.length}`
    );

    // If we have all required valid tokens and scopes
    if (missingScopes.length === 0 && validTokens.length >= services.length) {
      console.log('✅ User has all valid Google tokens');
      res.status(200).json({
        status: 'success',
        message: 'Đã xác thực tất cả dịch vụ',
        hasValidTokens: true,
        existingTokens: existingTokensCount,
        validTokensCount: validTokens.length,
        totalServicesRequired: services.length,
        tokens: validTokens.map((token) => ({
          service: token.service,
          status: token.status,
          expiryDate: token.expiryDate,
          isValid: true,
          scopes: token.scopes,
        })),
      });
    } else if (validTokens.length > 0) {
      // User has some valid tokens but needs reauth for others
      console.log('🔄 User has some valid tokens but needs reauth for others');
      res.status(200).json({
        status: 'success',
        message: needsReauth
          ? 'Một số token đã hết hạn, cần xác thực lại'
          : 'Cần xác thực thêm quyền',
        hasValidTokens: false,
        needsRefresh: true,
        existingTokens: existingTokensCount,
        validTokensCount: validTokens.length,
        expiredTokensCount: expiredTokens.length + refreshFailedTokens.length,
        totalServicesRequired: services.length,
        missingScopes: missingScopes,
        tokens: [
          ...validTokens.map((token) => ({
            service: token.service,
            status: token.status,
            expiryDate: token.expiryDate,
            isValid: true,
            scopes: token.scopes,
          })),
          ...expiredTokens.map((token) => ({
            service: token.service,
            status: 'expired',
            expiryDate: token.expiryDate,
            isValid: false,
            scopes: token.scopes,
          })),
          ...refreshFailedTokens.map((token) => ({
            service: token.service,
            status: 'refresh_failed',
            expiryDate: token.expiryDate,
            isValid: false,
            scopes: token.scopes,
          })),
        ],
      });
    } else {
      // User has no valid tokens
      console.log('❌ User has no valid Google tokens');
      res.status(401).json({
        status: 'error',
        message: 'Chưa xác thực đầy đủ các dịch vụ',
        hasValidTokens: false,
        needsRefresh: false,
        existingTokens: 0,
        validTokensCount: 0,
        totalServicesRequired: services.length,
        tokens: [],
      });
    }
  } catch (error) {
    console.error('❌ Error checking Google auth:', error.message);
    next(new AppError('Error checking Google auth: ' + error.message, 500));
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

    //Gửi thông báo cho user sau khi xác thực thành công
    await NotificationService.createPersonalNotification({
      title: 'Google Authentication Successful',
      content:
        // 'Bạn đã xác thực thành công tài khoản Google. Giờ đây bạn có thể tiếp tục sử dụng dịch vụ của chúng tôi.',
        'You have successfully authenticated your Google account. You can now continue using our services.',
      type: 'google_auth',
      targetUserId: userId,
      targetWorkspaceId: null,
      createdBy: getAdminId(),
      relatedUserId: null,
      eventId: null,
      taskId: null,
      messageId: null,
    });

    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  } catch (error) {
    console.error('Error handling Google auth callback:', error.message);
    const errorMessage = req.query.error
      ? decodeURIComponent(req.query.error)
      : 'Error handling Google auth callback: ' + error.message;
    res.status(400).json({
      status: 'error',
      message: errorMessage,
    });
  }
};

//Tác động tới các file đã được người dùng tạo từ trong ứng dụng (đã đồng bộ với google drive)
exports.uploadFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const file = req.file;
    if (!file) {
      return next(new AppError('Chưa chọn file để tải lên', 400));
    }

    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
    const drive = google.drive({ version: 'v3', auth });

    // Đảm bảo tên file được encode đúng UTF-8 cho Google Drive
    const sanitizedFileName = file.originalname.normalize('NFC');
    const fileMetadata = {
      name: sanitizedFileName,
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

    await fsPromises.unlink(file.path);

    res.status(200).json({
      status: 'success',
      data: {
        fileId: data.id,
        fileName: data.name,
        webViewLink: data.webViewLink,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    next(new AppError('Error uploading file: ' + error.message, 500));
  }
};

//Tích hợp file vào task
exports.uploadFileToTask = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { taskId } = req.body; // Nhận taskId từ request
    const file = req.file;
    if (!file) {
      return next(new AppError('Chưa chọn file để tải lên', 400));
    }
    if (!taskId) {
      return next(new AppError('Vui lòng cung cấp taskId', 400));
    }

    // Kiểm tra task tồn tại và người dùng có quyền
    const task = await Task.findById(taskId);
    if (!task) {
      return next(new AppError('Không tìm thấy task', 404));
    }
    // Kiểm tra quyền: user phải là assignedTo, assignedBy, hoặc nếu task chưa assign thì assignedBy có quyền
    const isAssignedTo = task.assignedTo && task.assignedTo.equals(userId);
    const isAssignedBy = task.assignedBy && task.assignedBy.equals(userId);

    if (!isAssignedTo && !isAssignedBy) {
      return next(
        new AppError('Bạn không có quyền thêm file vào task này', 403)
      );
    }

    // Tải file lên Google Drive
    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
    const drive = google.drive({ version: 'v3', auth });

    // Đảm bảo tên file được encode đúng UTF-8 cho Google Drive
    const sanitizedFileName = file.originalname.normalize('NFC');
    const fileMetadata = {
      name: sanitizedFileName,
      parents: ['root'],
    };
    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.path),
    };
    const { data } = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, webViewLink, mimeType',
    });

    // Lưu vào model File
    const fileDoc = await File.create({
      name: data.name,
      url: data.webViewLink,
      googleDriveFileId: data.id,
      type: data.mimeType.includes('image')
        ? 'image'
        : data.mimeType.includes('pdf')
        ? 'pdf'
        : data.mimeType.includes('document')
        ? 'doc'
        : 'other',
      size: file.size,
      uploadedBy: userId,
      taskId,
    });

    // Thêm file vào task
    task.documents.push(fileDoc._id);
    await task.save();

    // Ghi activity log
    try {
      const log = await ActivityLog.create({
        boardId: task.boardId,
        userId: userId,
        action: 'task_document_added',
        targetId: task._id,
        targetType: 'task',
        details: `File "${data.name}" uploaded to task "${task.title}"`,
        isVisible: true,
      });

      // Emit to board members
      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId,
        userName: req.user.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        isVisible: log.isVisible,
        createdAt: formatDateToTimeZone(log.createdAt),
      };

      emitToBoard(task.boardId.toString(), 'new_activity', formattedLog);

      // Send notification to assigned user if different from uploader
      if (task.assignedTo && !task.assignedTo.equals(userId)) {
        await NotificationService.createPersonalNotification({
          title: 'New file is added to task',
          content: `File "${data.name}" is added to task "${task.title}"`,
          type: 'task_document_added',
          targetUserId: task.assignedTo,
          targetWorkspaceId: task.workspaceId,
          createdBy: userId,
          taskId: task._id,
        });
      }
    } catch (logError) {
      console.error('Error creating activity log for file upload:', logError);
    }

    // Xóa file tạm trên server
    await fsPromises.unlink(file.path);

    res.status(200).json({
      status: 'success',
      data: {
        fileId: data.id,
        fileName: data.name,
        webViewLink: data.webViewLink,
        fileDocId: fileDoc._id,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    next(new AppError('Error uploading file: ' + error.message, 500));
  }
};

exports.downloadFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileDocId } = req.params;

    const fileDoc = await File.findById(fileDocId).populate('taskId');
    if (!fileDoc || fileDoc.isDeleted) {
      return next(new AppError('Không tìm thấy file hoặc file đã bị xóa', 404));
    }
    const task = fileDoc.taskId;
    // Kiểm tra quyền: user phải là assignedTo, assignedBy, hoặc người upload file
    const isAssignedTo = task.assignedTo && task.assignedTo.equals(userId);
    const isAssignedBy = task.assignedBy && task.assignedBy.equals(userId);
    const isUploader = fileDoc.uploadedBy.equals(userId);

    if (!isAssignedTo && !isAssignedBy && !isUploader) {
      return next(new AppError('Bạn không có quyền truy cập file này', 403));
    }

    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
    const drive = google.drive({ version: 'v3', auth });
    const { data } = await drive.files.get(
      { fileId: fileDoc.googleDriveFileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Set headers với tên file an toàn
    res.setHeader('Content-Type', fileDoc.type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      createContentDispositionHeader(fileDoc.name)
    );
    data.pipe(res);
  } catch (error) {
    // console.error('Lỗi khi tải file:', error.message);
    next(new AppError('Tải file thất bại: ' + error.message, 500));
  }
};

exports.listFiles = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { taskId } = req.params;

    // Kiểm tra quyền truy cập task (nếu có taskId)
    if (taskId) {
      const task = await Task.findById(taskId);
      if (!task) {
        return next(new AppError('Không tìm thấy task', 404));
      }
      // Kiểm tra quyền: user phải là assignedTo hoặc assignedBy
      const isAssignedTo = task.assignedTo && task.assignedTo.equals(userId);
      const isAssignedBy = task.assignedBy && task.assignedBy.equals(userId);

      if (!isAssignedTo && !isAssignedBy) {
        return next(new AppError('Bạn không có quyền truy cập task này', 403));
      }
    }

    // Lấy file từ model File
    const query = { uploadedBy: userId, isDeleted: false };
    if (taskId) query.taskId = taskId;
    const files = await File.find(query).select(
      'name url googleDriveFileId type size'
    );

    res.status(200).json({
      status: 'success',
      data: files,
    });
  } catch (error) {
    console.error('Error listing files:', error.message);
    next(new AppError('Error listing files: ' + error.message, 500));
  }
};

// Xem/tải file
// Cho phép người dùng trong task xem file (qua webViewLink) hoặc tải file về ứng dụng.
// Đảm bảo quyền truy cập bằng cách chia sẻ file trên Google Drive với người dùng trong task
exports.getFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileDocId } = req.params; // ID của document trong model File

    // Kiểm tra file trong model File
    const fileDoc = await File.findById(fileDocId).populate('taskId');
    if (!fileDoc || fileDoc.isDeleted) {
      return next(new AppError('Không tìm thấy file hoặc file đã bị xóa', 404));
    }

    // Kiểm tra quyền truy cập: user phải là assignedTo, assignedBy, hoặc người upload file
    const task = fileDoc.taskId;
    const isAssignedTo = task.assignedTo && task.assignedTo.equals(userId);
    const isAssignedBy = task.assignedBy && task.assignedBy.equals(userId);
    const isUploader = fileDoc.uploadedBy.equals(userId);

    if (!isAssignedTo && !isAssignedBy && !isUploader) {
      return next(new AppError('Bạn không có quyền truy cập file này', 403));
    }

    // Trả về thông tin file
    res.status(200).json({
      status: 'success',
      data: {
        fileId: fileDoc.googleDriveFileId,
        name: fileDoc.name,
        url: fileDoc.url,
        type: fileDoc.type,
        size: fileDoc.size,
      },
    });
  } catch (error) {
    console.error('Error getting file:', error.message);
    next(new AppError('Error getting file: ' + error.message, 500));
  }
};

exports.shareFileWithTaskUsers = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileDocId, taskId } = req.body;

    // Kiểm tra file và task
    const fileDoc = await File.findById(fileDocId);
    if (!fileDoc || fileDoc.isDeleted) {
      return next(new AppError('Không tìm thấy file hoặc file đã bị xóa', 404));
    }
    const task = await Task.findById(taskId).populate('assignedTo assignedBy');
    if (!task) {
      return next(new AppError('Không tìm thấy task', 404));
    }
    if (!fileDoc.uploadedBy.equals(userId)) {
      return next(new AppError('Bạn không có quyền chia sẻ file này', 403));
    }

    // Chia sẻ file trên Google Drive với assignedTo và assignedBy
    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
    const drive = google.drive({ version: 'v3', auth });
    // const users = [task.assignedTo, task.assignedBy].filter(Boolean);
    const users = [task.assignedTo].filter(Boolean); //Chia sẻ quyền reader với người được giao nhiệm vụ
    for (const user of users) {
      if (user.email) {
        await drive.permissions.create({
          fileId: fileDoc.googleDriveFileId,
          resource: {
            type: 'user',
            role: 'reader',
            emailAddress: user.email,
          },
          fields: 'id',
        });
      }
    }

    // Ghi activity log
    try {
      const log = await ActivityLog.create({
        boardId: task.boardId,
        userId: userId,
        action: 'task_document_shared',
        targetId: task._id,
        targetType: 'task',
        details: `File "${fileDoc.name}" shared with task members for task "${task.title}"`,
        isVisible: true,
      });

      // Emit to board members
      const formattedLog = {
        logId: log._id,
        boardId: log.boardId,
        userId: log.userId,
        userName: req.user.fullname || 'Unknown User',
        action: log.action,
        details: log.details,
        isVisible: log.isVisible,
        createdAt: formatDateToTimeZone(log.createdAt),
      };

      emitToBoard(task.boardId.toString(), 'new_activity', formattedLog);

      // Send notification to shared users
      for (const user of users) {
        if (!user._id.equals(userId)) {
          await NotificationService.createPersonalNotification({
            title: 'File is shared with you',
            content: `File "${fileDoc.name}" in task "${task.title}" is shared with you.`,
            type: 'file_shared',
            targetUserId: user._id,
            targetWorkspaceId: task.workspaceId,
            createdBy: userId,
            taskId: task._id,
          });
        }
      }
    } catch (logError) {
      console.error('Error creating activity log for file sharing:', logError);
    }

    res.status(200).json({
      status: 'success',
      message: 'Share file successfully with task users',
    });
  } catch (error) {
    console.error('Error sharing file:', error.message);
    next(new AppError('Error sharing file: ' + error.message, 500));
  }
};

//Cho phép sửa tên hoặc nội dung file trên Google Drive
exports.updateFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileDocId, newName } = req.body; // Sử dụng fileDocId từ model File

    // Kiểm tra file trong model File
    const fileDoc = await File.findById(fileDocId).populate('taskId');
    if (!fileDoc || fileDoc.isDeleted) {
      return next(new AppError('Không tìm thấy file hoặc file đã bị xóa', 404));
    }
    if (!fileDoc.uploadedBy.equals(userId)) {
      return next(new AppError('Bạn không có quyền sửa file này', 403));
    }

    const oldName = fileDoc.name;

    // Cập nhật trên Google Drive
    const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
    const drive = google.drive({ version: 'v3', auth });
    const fileMetadata = { name: newName || fileDoc.name };
    const { data } = await drive.files.update({
      fileId: fileDoc.googleDriveFileId,
      resource: fileMetadata,
      fields: 'id, name, webViewLink',
    });

    // Cập nhật model File
    fileDoc.name = data.name;
    fileDoc.url = data.webViewLink;
    await fileDoc.save();

    // Ghi activity log nếu file thuộc về task
    if (fileDoc.taskId) {
      try {
        const task = fileDoc.taskId;
        const log = await ActivityLog.create({
          boardId: task.boardId,
          userId: userId,
          action: 'task_document_renamed',
          targetId: task._id,
          targetType: 'task',
          details: `File renamed from "${oldName}" to "${data.name}" in task "${task.title}"`,
          isVisible: true,
        });

        // Emit to board members
        const formattedLog = {
          logId: log._id,
          boardId: log.boardId,
          userId: log.userId,
          userName: req.user.fullname || 'Unknown User',
          action: log.action,
          details: log.details,
          isVisible: log.isVisible,
          createdAt: formatDateToTimeZone(log.createdAt),
        };

        emitToBoard(task.boardId.toString(), 'new_activity', formattedLog);
      } catch (logError) {
        console.error('Error creating activity log for file rename:', logError);
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        fileId: data.id,
        fileName: data.name,
        webViewLink: data.webViewLink,
      },
    });
  } catch (error) {
    console.error('Error updating file:', error.message);
    next(new AppError('Error updating file: ' + error.message, 500));
  }
};

// Đánh dấu isDeleted trong model File
// có thể giữ file trên Google Drive
exports.deleteFile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fileDocId } = req.body; // ID của document trong model File

    // Kiểm tra file trong model File
    const fileDoc = await File.findById(fileDocId).populate('taskId');
    if (!fileDoc || fileDoc.isDeleted) {
      return next(new AppError('Không tìm thấy file hoặc file đã bị xóa', 404));
    }
    if (!fileDoc.uploadedBy.equals(userId)) {
      return next(new AppError('Bạn không có quyền xóa file này', 403));
    }

    const fileName = fileDoc.name;
    const task = fileDoc.taskId;

    try {
      // Thu hồi quyền chia sẻ trên Google Drive
      await revokeFilePermissions(userId, fileDoc.googleDriveFileId);

      // Xóa trên Google Drive
      const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
      const drive = google.drive({ version: 'v3', auth });
      await drive.files.delete({ fileId: fileDoc.googleDriveFileId });
    } catch (error) {
      console.error('Google Drive operation failed:', error.message);
      // Even if Google Drive operations fail, proceed with local deletion
    }

    // Đánh dấu xóa trong model File
    fileDoc.isDeleted = true;
    fileDoc.deletedAt = Date.now();
    await fileDoc.save();

    // Xóa file khỏi task
    await Task.updateMany(
      { documents: fileDocId },
      { $pull: { documents: fileDocId } }
    );

    // Ghi activity log nếu file thuộc về task
    if (task) {
      try {
        const log = await ActivityLog.create({
          boardId: task.boardId,
          userId: userId,
          action: 'task_document_removed',
          targetId: task._id,
          targetType: 'task',
          details: `File "${fileName}" removed from task "${task.title}"`,
          isVisible: false, // Sensitive - only show to relevant users
        });

        // Emit to relevant users only (assignee, assigner, admins)
        const formattedLog = {
          logId: log._id,
          boardId: log.boardId,
          userId: log.userId,
          userName: req.user.fullname || 'Unknown User',
          action: log.action,
          details: log.details,
          isVisible: log.isVisible,
          createdAt: formatDateToTimeZone(log.createdAt),
        };

        // Get relevant users
        const relevantUsers = [];
        if (task.assignedTo) relevantUsers.push(task.assignedTo.toString());
        if (task.assignedBy) relevantUsers.push(task.assignedBy.toString());

        // Add board admins
        const BoardMembership = require('../models/boardMembershipModel');
        const admins = await BoardMembership.find({
          boardId: task.boardId,
          role: 'admin',
          isDeleted: false,
        }).select('userId');

        admins.forEach((admin) => {
          relevantUsers.push(admin.userId.toString());
        });

        // Remove duplicates and emit to each relevant user
        const uniqueUsers = [...new Set(relevantUsers)];
        uniqueUsers.forEach((userId) => {
          emitToUser(userId, 'task_activity', formattedLog);
        });

        // Send notification to assigned user if different from deleter
        if (task.assignedTo && !task.assignedTo.equals(userId)) {
          await NotificationService.createPersonalNotification({
            title: 'File is removed from task',
            content: `File "${fileName}" is removed from task "${task.title}"`,
            type: 'task_document_removed',
            targetUserId: task.assignedTo,
            targetWorkspaceId: task.workspaceId,
            createdBy: userId,
            taskId: task._id,
          });
        }
      } catch (logError) {
        console.error(
          'Error creating activity log for file deletion:',
          logError
        );
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Delete file successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error.message);
    next(new AppError('Error deleting file: ' + error.message, 500));
  }
};

// thu hồi quyền chia sẻ trên Google Drive
async function revokeFilePermissions(userId, fileId) {
  const auth = await authorize(userId, 'drive', DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });
  const { data } = await drive.permissions.list({ fileId });

  for (const permission of data.permissions) {
    // Skip owner and anyoneWithLink permissions
    if (permission.role === 'owner' || permission.id === 'anyoneWithLink') {
      continue;
    }
    try {
      await drive.permissions.delete({ fileId, permissionId: permission.id });
    } catch (error) {
      console.error(
        `Failed to revoke permission ${permission.id}:`,
        error.message
      );
      // Continue with other permissions even if one fails
    }
  }
}
