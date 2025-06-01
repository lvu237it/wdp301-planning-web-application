// routes/authenticationRoutes.js

const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  updateMyPassword,
} = require("../controllers/authenticationController");

const { verifyToken } = require("../middlewares/verifyToken");

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:token", resetPassword);

// Protected route: update own password
router.patch("/updateMyPassword", verifyToken, updateMyPassword);

// Protected route: logout
router.get("/logout", verifyToken, logout);

module.exports = router;
