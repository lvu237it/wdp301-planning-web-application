const express = require('express');
const router = express.Router({ mergeParams: true });
const boardController = require('../controllers/boardController');
const { isCreatorBoard, isAdminBoard, protect, isAdminWorkspace } = require('../utils/auth');

router.get('/', protect, boardController.getAllBoards);

// 1. Tạo Board (chỉ cần verifyToken, không cần check role)
router.post('/create', protect, isAdminWorkspace, boardController.createBoard);

// 2. Cập nhật Board (chỉ creator hoặc admin mới được phép)
router.put('/:id', protect, isAdminBoard, boardController.updateBoard);

// 3. Đóng (soft‐delete) Board (chỉ creator hoặc admin)
router.patch('/:id/close', protect, isAdminBoard, boardController.closeBoard);

// 4. Xóa vĩnh viễn Board (chỉ creator)
router.delete('/:id', protect, isCreatorBoard, boardController.deleteBoard);

// 5. Mời thành viên vào Board (chỉ creator hoặc admin)
router.post('/:id/invite', protect, isAdminBoard, boardController.inviteBoardMember);

// 6. Phản hồi lời mời (không cần verifyToken, vì user có thể bấm link từ email)
router.post('/invite-response', boardController.respondToBoardInvite);

module.exports = router;
