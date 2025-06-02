const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const auth = require('../utils/auth');

router.post(
  '/create-event-for-calendar/:calendarId',
  auth.protect,
  eventController.createEventForCalendar
);
router.get('/:id', auth.protect, eventController.getEventById);
router.get('/', auth.protect, eventController.getAllEvents);
router.patch('/:id', auth.protect, eventController.updateEvent);
router.delete('/:id', auth.protect, eventController.deleteEvent);
router.post('/:id/participants', auth.protect, eventController.addParticipant);
router.patch(
  '/:id/participants/:userId',
  auth.protect,
  eventController.updateParticipantStatus
);
router.delete(
  '/:id/participants/:userId',
  auth.protect,
  eventController.removeParticipant
);
router.get('/:id/history', auth.protect, eventController.getEventHistory);
router.post('/:id/reminders', auth.protect, eventController.sendEventReminder);
router.post('/recurring', auth.protect, eventController.createRecurringEvents);
router.post('/:id/files', auth.protect, eventController.addFileToEvent);
router.get('/:id/files', auth.protect, eventController.getEventFiles);
router.delete(
  '/:id/files/:fileId',
  auth.protect,
  eventController.deleteEventFile
);
router.post('/:id/messages', auth.protect, eventController.addMessageToEvent);
router.get('/:id/messages', auth.protect, eventController.getEventMessages);
router.delete(
  '/:id/messages/:messageId',
  auth.protect,
  eventController.deleteEventMessage
);

module.exports = router;
