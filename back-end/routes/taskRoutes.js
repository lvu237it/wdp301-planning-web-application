const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect } = require('../utils/auth');
router.get('/', protect, taskController.getAllTask);
router.get('/get-by-board/:boardId', protect, taskController.getTasksByBoard);
router.get('/:id', protect, taskController.getTaskId);
router.post('/createTask', protect, taskController.createTask);
router.put('/updateTask/:id', protect, taskController.updateTask);
router.put('/:id/checklist', protect, taskController.updateChecklistItem);
router.delete('/deleteTask/:id', protect, taskController.deleteTask);
router.post('/:id/assign', protect, taskController.assignTask);
router.delete('/:id/assign', protect, taskController.unassignTask);
router.put('/reorder', protect, taskController.reorderTasks);
router.get('/user/:userId', protect, taskController.getTasksByUser);

module.exports = router;
