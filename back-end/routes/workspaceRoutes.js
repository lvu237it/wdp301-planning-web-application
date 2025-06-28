const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const { protect, isAdminWorkspace, isCreator } = require('../utils/auth');

router.get('/', protect, workspaceController.getAllWorkspace);
router.post('/create', protect, workspaceController.createWorkspace);
router.put(
  '/:workspaceId',
  protect,
  isAdminWorkspace,
  workspaceController.updateWorkspace
);
router.patch(
  '/:workspaceId/close',
  protect,
  isAdminWorkspace,
  workspaceController.closeWorkspace
);
router.delete(
  '/:workspaceId',
  protect,
  isCreator,
  workspaceController.deleteWorkspace
);
router.post(
  '/:workspaceId/invite',
  protect,
  isAdminWorkspace,
  workspaceController.inviteMember
);
router.post('/invite-response', workspaceController.respondToInvite);

// Route để lấy board details mà không cần workspaceId
router.get(
  '/board/:boardId',
  protect,
  require('../controllers/boardController').getBoardById
);

module.exports = router;
