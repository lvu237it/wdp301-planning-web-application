const express = require('express');
const router = express.Router();
const {
  createEventMessage,
  getEventMessages,
  editEventMessage,
  deleteEventMessage,
} = require('../controllers/messageController');
const auth = require('../utils/auth');

router.use(auth.protect);

// Event message routes
router.post('/event/:eventId', createEventMessage);
router.get('/event/:eventId', getEventMessages);
router.patch('/:messageId', editEventMessage);
router.delete('/:messageId', deleteEventMessage);

module.exports = router;
