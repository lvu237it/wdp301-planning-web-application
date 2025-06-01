const express = require("express");
const app = express();
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

// utils
const AppError = require("./utils/appError");
const frontendURL = process.env.FRONTEND_URL;
// import routers
const userRouter = require("./routes/userRoutes");
const calendarGoogleAPIRouter = require("./routes/calendarGoogleAPIRoutes");
const authRouter = require("./routes/authenticationRoutes");

// các middleware
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: frontendURL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ————————————————
// 2) Swagger UI (serve swagger.json at /api-docs)
// ————————————————
// Load your swagger.json (which should reference /auth and /users, not /api/auth)
const swaggerDocument = require("./swagger.json");

// Serve the Swagger UI. Now you can visit http://localhost:3000/api-docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Route xử lý callback từ Google OAuth
app.get("/auth/google/callback", (req, res) => {
  const code = req.query.code; // Lấy mã ủy quyền từ Google
  if (code) {
    console.log("Authorization code received:", code);
    res.send("Xác thực thành công! Bạn có thể đóng cửa sổ này.");
  } else {
    console.error("No authorization code received");
    res.status(400).send("Lỗi xác thực: Không nhận được mã ủy quyền.");
  }
});

// routing handlers
app.use("/users", userRouter);
app.use("/calendar", calendarGoogleAPIRouter);
app.use("/authentication", authRouter);
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

module.exports = app;
