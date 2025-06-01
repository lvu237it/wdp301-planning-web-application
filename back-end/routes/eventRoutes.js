const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

router.post('/', eventController.createEvent);
router.get('/:id', eventController.getEventById);
router.get('/', eventController.getAllEvents);
router.patch('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);
router.post('/:id/participants', eventController.addParticipant);
router.patch(
  '/:id/participants/:userId',
  eventController.updateParticipantStatus
);
router.delete('/:id/participants/:userId', eventController.removeParticipant);
router.get('/:id/history', eventController.getEventHistory);
router.post('/:id/reminders', eventController.sendEventReminder);
router.post('/recurring', eventController.createRecurringEvents);
router.post('/:id/files', eventController.addFileToEvent);
router.get('/:id/files', eventController.getEventFiles);
router.delete('/:id/files/:fileId', eventController.deleteEventFile);
router.post('/:id/messages', eventController.addMessageToEvent);
router.get('/:id/messages', eventController.getEventMessages);
router.delete('/:id/messages/:messageId', eventController.deleteEventMessage);

module.exports = router;
