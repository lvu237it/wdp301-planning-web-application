const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const auth = require('../utils/auth');

router.get('/', auth.protect, calendarController.getAllCalendars);

router.post('/', auth.protect, calendarController.createCalendar);
router.get('/:id', auth.protect, calendarController.getCalendarById);
router.patch('/:id', auth.protect, calendarController.updateCalendar);
router.delete('/:id', auth.protect, calendarController.deleteCalendar);
router.get('/:id/events', auth.protect, calendarController.getCalendarEvents);
router.get('/:id/tasks', auth.protect, calendarController.getCalendarTasks);

module.exports = router;
