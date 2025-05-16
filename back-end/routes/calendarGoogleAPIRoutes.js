const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarGoogleAPIController');

router.post('/add-event', calendarController.addCalendarEvent);

module.exports = router;
