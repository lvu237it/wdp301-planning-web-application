const express = require('express');
const router = express.Router({ mergeParams: true });
const boardController = require('../controllers/boardController');
const {
  isCreatorBoard,
  isAdminBoard,
  protect,
  isAdminWorkspace,
} = require('../utils/auth');

router.get('/', protect, boardController.getBoardsByWorkspace);

// 1. Lấy chi tiết Board theo ID
router.get('/:boardId', protect, boardController.getBoardById);

// 2. Tạo Board (chỉ cần verifyToken, không cần check role)
router.post('/create', protect, isAdminWorkspace, boardController.createBoard);

// 3. Cập nhật Board (chỉ creator hoặc admin mới được phép)
router.put('/:boardId', protect, isAdminBoard, boardController.updateBoard);

// 4. Đóng (soft‐delete) Board (chỉ creator hoặc admin)
router.patch(
  '/:boardId/close',
  protect,
  isAdminBoard,
  boardController.closeBoard
);

// 5. Xóa vĩnh viễn Board (chỉ creator)
router.delete(
  '/:boardId',
  protect,
  isCreatorBoard,
  boardController.deleteBoard
);

// 6. Mời thành viên vào Board (chỉ creator hoặc admin)
router.post(
  '/:boardId/invite',
  protect,
  isAdminBoard,
  boardController.inviteBoardMembers
);

// 7. Phản hồi lời mời (không cần verifyToken, vì user có thể bấm link từ email)
router.post('/invite-response', boardController.respondToBoardInvite);

// // 8. Gợi ý thành viên theo skills
// router.get(
//   '/:boardId/suggest-members',
//   protect,
//   boardController.suggestMembersBySkills
// );

// // 9. Lấy ra user đủ điều kiện trên board
// router.get(
//   '/:boardId/qualified-users',
//   protect,
//   boardController.getQualifiedUsers
// );

//7. lấy ra user đủ điều kiện trên board
router.get(
  '/:boardId/qualified-users',
  protect,
  boardController.getQualifiedUsers
);

// Route để lấy board details mà không cần workspaceId
router.get(
  '/:boardId',
  protect,
  require('../controllers/boardController').getBoardById
);

// lọc member theo skill và date
router.get(
  '/:boardId/suggest-members',
  protect,
  boardController.suggestMembers
);

module.exports = router;
