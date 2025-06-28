const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const auth = require('../utils/auth');

// router.get('/', auth.protect, calendarController.getAllCalendarsUserOrGroup); //ok
// router.get('/:id', auth.protect, calendarController.getCalendarById); //ok
// router.patch(
//   '/update-calendar/:id',
//   auth.protect,
//   calendarController.updateCalendar
// ); //ok

// router.post(
//   '/create-new-calendar',
//   auth.protect,
//   calendarController.createCalendar //ok
// );
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
// router.delete(
//   '/delete-calendar/:id',
//   auth.protect,
//   calendarController.deleteCalendar //ok
// );
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
