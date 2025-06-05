// verifyToken.js

const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const AppError = require("../utils/appError");

/**
 * @desc    Middleware to verify that the request has a valid JWT.
 *          If valid, attaches the decoded payload to req.user = { id, role, ... }.
 *          If invalid or missing, returns 401.
 *
 * Usage:
 *   app.use(verifyToken);
 */
const verifyToken = async (req, res, next) => {
  let token;

  // 1) Attempt to read token from "Authorization" header: "Bearer <token>"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // 2) If not found in header, try cookie "jwt"
  else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required: no token provided",
    });
  }

  try {
    // 3) Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4) Optionally: ensure that the user still exists and is active
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "The user belonging to this token no longer exists",
      });
    }

    // 5) Check if password was changed after the token was issued
    if (currentUser.passwordChangedAt) {
      const changedTimestamp = parseInt(
        currentUser.passwordChangedAt.getTime() / 1000,
        10
      );
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          success: false,
          message: "User recently changed password! Please log in again",
        });
      }
    }

    // 6) Attach user info onto req.user
    req.user = {
      id: currentUser._id,
      role: currentUser.role,
      // you can also attach other fields if you need them:
      // email: currentUser.email
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/**
 * @desc    Middleware to restrict access to only users with "admin" role
 *
 * Usage:
 *   router.use(restrictTo('admin'));
 */
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user must already be populated by verifyToken
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};

/**
 * @desc    Shorthand middleware to only allow admins
 *
 * Usage:
 *   router.use(isAdmin);
 */
const isAdmin = restrictTo("admin");

module.exports = {
  verifyToken,
  restrictTo,
  isAdmin,
};
