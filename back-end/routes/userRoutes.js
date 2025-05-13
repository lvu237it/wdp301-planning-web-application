/*
Định nghĩa router xử lý từng request từ phía client gửi tới server
*/

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../utils/auth');

// Gọi tới các module xử lý request từ controller
// router.post('/create-new-user', userController.createAnUser);
router.get('/', userController.getAllUser);
router.get('/:userId', protect, userController.getUserById);
router.get('/:userId/recipes', userController.findAllRecipesByUser);
router.get('/:userId/recipe/:recipeId', protect, userController.findDetail);
router.patch('/:userId/edit-information', protect, userController.updateUser);

module.exports = router;
