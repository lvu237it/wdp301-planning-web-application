const express = require('express');
const app = express();
const morgan = require('morgan');
const cors = require('cors');
// utils
const AppError = require('./utils/appError');
const frontendURL = process.env.FRONTEND_URL;
// import routers
const authenticationRoutes = require('./routes/authenticationRoutes');
const userRouter = require('./routes/userRoutes');
const calendarGoogleAPIRouter = require('./routes/calendarGoogleAPIRoutes');
const workspaceRouter = require('./routes/workspaceRoutes');

// các middleware
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: frontendURL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Route xử lý callback từ Google OAuth
// app.get('/auth/google/callback', (req, res) => {
//   const code = req.query.code; // Lấy mã ủy quyền từ Google
//   if (code) {
//     console.log('Authorization code received:', code);
//     res.send('Xác thực thành công! Bạn có thể đóng cửa sổ này.');
//   } else {
//     console.error('No authorization code received');
//     res.status(400).send('Lỗi xác thực: Không nhận được mã ủy quyền.');
//   }
// });

// routing handlers
app.use('/', authenticationRoutes);
app.use('/users', userRouter);
app.use('/calendar', calendarGoogleAPIRouter);
app.use('/workspace', workspaceRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

module.exports = app;
