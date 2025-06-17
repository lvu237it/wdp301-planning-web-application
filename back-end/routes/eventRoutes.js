const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const auth = require('../utils/auth');

router.post(
  '/create-event-for-calendar/:calendarId',
  auth.protect,
  eventController.createEventForCalendar //ok
);
router.get('/', auth.protect, eventController.getAllEvents); //ok
router.get(
  '/participated',
  auth.protect,
  eventController.getParticipatedEvents
); // Lấy sự kiện đã tham gia

router.post(
  '/:id/invite',
  auth.protect,
  eventController.inviteToBecomeParticipant
); //ok
router.post('/:id/reminders', auth.protect, eventController.sendEventReminder);
router.patch(
  '/:id/update-status-by-time',
  auth.protect,
  eventController.updateEventStatusByTime
); // Cập nhật trạng thái dựa trên thời gian
router.patch(
  '/:id/cancel-invitation-and-give-reason',
  auth.protect,
  eventController.cancelAnInvitationWhenAcceptBefore
);

router.get('/:id/history', auth.protect, eventController.getEventHistory); //ok
router.patch(
  '/:id/participants/:userId/update-status',
  auth.protect,
  eventController.acceptOrDeclineParticipantStatus //ok
);
router.delete(
  '/:id/participants/:userId/remove',
  auth.protect,
  eventController.removeParticipant //ok
);

router.get('/:id', auth.protect, eventController.getEventById); //ok
router.patch('/:id', auth.protect, eventController.updateEvent); //ok
router.delete('/:id', auth.protect, eventController.deleteEvent); //ok

module.exports = router;
