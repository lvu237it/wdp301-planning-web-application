const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { protect } = require('../utils/auth');

router.get('/board/:boardId', protect, activityLogController.getLogsByBoard);
router.get(
  '/board/:boardId/admin',
  protect,
  activityLogController.getAdminLogsByBoard
);

module.exports = router;
