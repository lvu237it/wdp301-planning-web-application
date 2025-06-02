const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const auth = require('../utils/auth');

router.post(
  '/create-event-for-calendar/:calendarId',
  auth.protect,
  eventController.createEventForCalendar //ok
);
router.get('/:id', auth.protect, eventController.getEventById); //ok
router.get('/', auth.protect, eventController.getAllEvents); //ok
router.patch('/:id', auth.protect, eventController.updateEvent); //ok
router.delete('/:id', auth.protect, eventController.deleteEvent); //ok
router.post(
  '/:id/invite',
  auth.protect,
  eventController.inviteToBecomeParticipant
); //ok
router.patch(
  '/:id/participants/:userId/update-status',
  auth.protect,
  eventController.updateParticipantStatus //ok
);
router.delete(
  '/:id/participants/:userId/remove',
  auth.protect,
  eventController.removeParticipant //ok
);
router.get('/:id/history', auth.protect, eventController.getEventHistory);
router.post('/:id/reminders', auth.protect, eventController.sendEventReminder);

module.exports = router;
