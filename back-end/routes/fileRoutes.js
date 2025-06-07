const express = require('express');
const multer = require('multer');
const fileController = require('../controllers/fileController');
const auth = require('../utils/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Route cho xác thực Google Drive
router.get('/google-auth', auth.protect, fileController.getGoogleAuthUrl);

// Route cho các thao tác với file
router.post(
  '/upload',
  auth.protect,
  upload.single('file'),
  fileController.uploadFile
);
router.get('/list', auth.protect, fileController.listFiles);
router.delete('/:fileId', auth.protect, fileController.deleteFile);

module.exports = router;
