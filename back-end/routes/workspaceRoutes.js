const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const { protect, isAdminWorkspace, isCreator } = require('../utils/auth');


router.get('/', protect, workspaceController.getAllWorkspace);
router.post('/create', protect, workspaceController.createWorkspace);
router.put('/:id', protect, isAdminWorkspace, workspaceController.updateWorkspace);
router.patch('/:id/close', protect, isAdminWorkspace, workspaceController.closeWorkspace);
router.delete('/:id', protect, isCreator, workspaceController.deleteWorkspace);






module.exports = router;