const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const auth = require('../utils/auth');

router.post(
  '/create-event-for-calendar/:calendarId',
  auth.protect,
  eventController.createEventForCalendar //ok
);
router.post(
  '/check-conflicts',
  auth.protect,
  eventController.checkEventConflicts
);
router.post(
  '/find-available-slots',
  auth.protect,
  eventController.findAvailableTimeSlots
);
router.get('/', auth.protect, eventController.getAllEvents); //ok
router.get(
  '/participated',
  auth.protect,
  eventController.getParticipatedEvents
); // Lấy sự kiện đã tham gia

// Cập nhật trạng thái tất cả sự kiện của user dựa trên thời gian (Bulk update - improved)
router.patch(
  '/update-all-status-by-time',
  auth.protect,
  eventController.updateAllUserEventsStatusByTime
);

// Cập nhật trạng thái sự kiện cụ thể dựa trên thời gian (Legacy - backward compatibility)
router.patch(
  '/:id/update-status-by-time',
  auth.protect,
  eventController.updateEventStatusByTime
);

router.post(
  '/:id/invite',
  auth.protect,
  eventController.inviteToBecomeParticipant
); //ok

router.patch(
  '/:id/cancel-invitation-and-give-reason',
  auth.protect,
  eventController.cancelAnInvitationWhenAcceptBefore
);

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
