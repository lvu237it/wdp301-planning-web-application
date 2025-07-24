const express = require('express');
const multer = require('multer');
const fileController = require('../controllers/fileController');
const auth = require('../utils/auth');

const router = express.Router();

// Cấu hình multer với hỗ trợ UTF-8 cho tên file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Đảm bảo tên file được encode đúng UTF-8
    const originalName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8'
    );
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + originalName);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Đảm bảo originalname được decode đúng
    file.originalname = Buffer.from(file.originalname, 'latin1').toString(
      'utf8'
    );
    cb(null, true);
  },
});

// Route cho xác thực Google Drive
router.get('/get-auth-url', auth.protect, fileController.getGoogleAuthUrl);
router.get('/check-google-auth', auth.protect, fileController.checkGoogleAuth);

// Route cho các thao tác với file
router.get('/:fileDocId', auth.protect, fileController.getFile);
router.get('/list-file/:taskId', auth.protect, fileController.listFiles);
router.get('/download/:fileDocId', auth.protect, fileController.downloadFile);
router.post(
  '/share/:fileDocId',
  auth.protect,
  fileController.shareFileWithTaskUsers
);
router.post(
  '/upload-to-task',
  auth.protect,
  upload.single('file'),
  fileController.uploadFileToTask
);
router.patch('/update/:fileDocId', auth.protect, fileController.updateFile);
router.delete('/:fileDocId', auth.protect, fileController.deleteFile);

module.exports = router;
