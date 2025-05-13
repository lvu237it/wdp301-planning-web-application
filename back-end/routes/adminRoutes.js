const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const commentController = require('../controllers/commentController');
const { protect } = require('../utils/auth');

//Router for business logic here
//default: /admin

//recipes
router.get('/recipes', protect, adminController.getAllRecipe);
router.get('/recipes/:recipeId', protect, adminController.getRecipeDetails);
router.patch(
  '/recipes/:recipeId/status',
  protect,
  adminController.updateRecipeStatus
);
//comment
router.get(
  '/recipes/:recipeId/comments',
  protect,
  commentController.getAllCommentsForAdmin
);
router.patch(
  '/recipes/:recipeId/delete-comment/:commentId',
  protect,
  adminController.deleteCommentByAdmin
);

module.exports = router;
