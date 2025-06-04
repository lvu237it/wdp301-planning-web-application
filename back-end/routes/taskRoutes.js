const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

const { protect } = require('../utils/auth');
router.get('/', taskController.getAllTask);
router.get('/:id', taskController.getTaskId);
router.post('/createTask', taskController.createTask);
router.put('/updateTask/:id', protect, taskController.updateTask);
router.delete('/deleteTask/:id', taskController.deleteTask);

module.exports = router;
