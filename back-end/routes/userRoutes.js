// routes/userRoutes.js

const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  changePassword,
  deactivateMe,
  getAllUsers,
  updateUserById,
  deleteUserById,
} = require("../controllers/userController");
const { verifyToken, restrictTo } = require("../middlewares/verifyToken");

// ---------------------------
// All routes below require valid JWT
// ---------------------------
router.use(verifyToken);

// “Self-Service” (any authenticated user)
router
  .get("/profile", getProfile)
  .put("/update", updateProfile)
  .put("/change-password", changePassword)
  .delete("/delete-me", deactivateMe);

// ---------------------------
// Admin-Only Endpoints
// ---------------------------

// GET /api/users                → getAllUsers
// PUT /api/users/:id            → updateUserById
// DELETE /api/users/:id         → deleteUserById

// Only adminSystem can call these admin‐level routes
router.route("/").get(verifyToken, restrictTo("adminSystem"), getAllUsers);

router
  .route("/:id")
  .put(verifyToken, restrictTo("adminSystem"), updateUserById)
  .delete(verifyToken, restrictTo("adminSystem"), deleteUserById);

module.exports = router;
