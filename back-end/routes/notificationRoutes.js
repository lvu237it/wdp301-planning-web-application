const express = require('express');
const router = express.Router();
const auth = require('../utils/auth');
const notificationController = require('../controllers/notificationController');

router.use(auth.protect);
router.route('/').get(notificationController.getUserNotifications);
router.route('/:notificationId/read').patch(notificationController.markAsRead);

module.exports = router;
