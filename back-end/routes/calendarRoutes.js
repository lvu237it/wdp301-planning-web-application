const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const auth = require('../utils/auth');

router.get(
  '/get-by-user',
  auth.protect,
  calendarController.getCalendarByUserId
); //ok
router.get(
  '/get-by-board/:boardId',
  auth.protect,
  calendarController.getCalendarByBoardId
); //ok

router.get('/:id/events', auth.protect, calendarController.getCalendarEvents); //ok

router
  .route('/')
  .get(auth.protect, calendarController.getAllCalendarsUserOrGroup)
  .post(auth.protect, calendarController.createCalendar);
router
  .route('/:id')
  .get(auth.protect, calendarController.getCalendarById)
  .patch(auth.protect, calendarController.updateCalendar)
  .delete(auth.protect, calendarController.deleteCalendar);

module.exports = router;
