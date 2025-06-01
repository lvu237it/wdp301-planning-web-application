// auth.js
const jwt = require("jsonwebtoken");
const User = require("./models/userModel");

exports.protect = async (req, res, next) => {
  try {
    // Expect header: Authorization: "Bearer <token>"
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);
    if (!user || user.isDeleted) {
      return res
        .status(401)
        .json({ status: "error", message: "User no longer exists" });
    }

    req.user = user; // full user document (password excluded later if needed)
    next();
  } catch (error) {
    return res.status(401).json({ status: "error", message: error.message });
  }
};

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ status: "error", message: "Forbidden: insufficient rights" });
    }
    next();
  };
