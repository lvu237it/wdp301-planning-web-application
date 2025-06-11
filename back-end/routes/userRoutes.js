// routes/userRoutes.js

const express = require('express');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  changePassword,
  deactivateMe,
  getAllUsers,
  updateUserById,
  deleteUserById,
  findUsersByEmails,
} = require('../controllers/userController');
const { protect } = require('../middlewares/auth');

// ---------------------------
// All routes below require valid JWT
// ---------------------------
router.use(protect);

// “Self-Service” (any authenticated user)
router
  .get('/profile', getProfile)
  .put('/update', updateProfile)
  .put('/change-password', changePassword)
  .delete('/delete-me', deactivateMe)
  .post('/find-by-emails', findUsersByEmails);

// ---------------------------
// Admin-Only Endpoints
// ---------------------------

// GET /api/users                → getAllUsers
// PUT /api/users/:id            → updateUserById
// DELETE /api/users/:id         → deleteUserById

// Only adminSystem can call these admin‐level routes
router.route('/').get(protect, getAllUsers);

router
  .route('/:id')
  .put(protect, updateUserById)
  .delete(protect, deleteUserById);

module.exports = router;
