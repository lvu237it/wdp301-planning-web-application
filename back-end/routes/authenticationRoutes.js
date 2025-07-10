// routes/authenticationRoutes.js

const express = require('express');
const router = express.Router();

const {
  signup,
  login,
  logoutUser,
  forgotPassword,
  resetPassword,
  updateMyPassword,
  googleAuth,
  googleAuthCallback,
  linkGoogleAccount,
  getCurrentUser,
  googleAuthCallbackUserData,
  checkGoogleLinkStatus,
  initiateGoogleLink,
  unlinkGoogleAccount,
} = require('../controllers/authenticationController');
const auth = require('../utils/auth');

const { verifyToken } = require('../middlewares/verifyToken');

// Public routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgotPassword', forgotPassword);
router.patch('/resetPassword/:token', resetPassword);

// Route cho đăng nhập Google
router.get('/google/login', googleAuth);
router.get('/auth/google/login/callback', googleAuthCallback);

// Special callback endpoint for frontend to get user data after OAuth
router.get('/auth/google/callback/userdata', googleAuthCallbackUserData);

// Routes cho liên kết tài khoản Google với tài khoản hiện tại
router.get('/google-link-status', verifyToken, checkGoogleLinkStatus); // Kiểm tra trạng thái liên kết
router.get('/link-google', verifyToken, initiateGoogleLink); // Khởi tạo liên kết Google
router.get('/auth/google/link/callback', linkGoogleAccount); // Callback sau khi liên kết
router.delete('/unlink-google', verifyToken, unlinkGoogleAccount); // Hủy liên kết Google

// Protected routes
router.get('/auth/me', verifyToken, getCurrentUser);
router.patch('/updateMyPassword', verifyToken, updateMyPassword);
router.get('/logout', verifyToken, logoutUser);

module.exports = router;
