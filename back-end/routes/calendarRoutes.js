const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const auth = require('../utils/auth');

router.get('/', auth.protect, calendarController.getAllCalendarsUserOrGroup); //ok

router.post(
  '/create-new-calendar',
  auth.protect,
  calendarController.createCalendar //ok
);
router.get('/:id', auth.protect, calendarController.getCalendarById); //ok
router.patch(
  '/update-calendar/:id',
  auth.protect,
  calendarController.updateCalendar
); //ok
router.delete(
  '/delete-calendar/:id',
  auth.protect,
  calendarController.deleteCalendar //ok
);
router.get('/:id/events', auth.protect, calendarController.getCalendarEvents);
router.get('/:id/tasks', auth.protect, calendarController.getCalendarTasks);

module.exports = router;
