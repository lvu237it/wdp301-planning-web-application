const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');

router.post('/', calendarController.createCalendar);
router.get('/:id', calendarController.getCalendarById);
router.get('/', calendarController.getAllCalendars);
router.patch('/:id', calendarController.updateCalendar);
router.delete('/:id', calendarController.deleteCalendar);
router.get('/:id/events', calendarController.getCalendarEvents);
router.get('/:id/tasks', calendarController.getCalendarTasks);

module.exports = router;
