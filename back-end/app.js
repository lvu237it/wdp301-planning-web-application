const express = require('express');
const app = express();

const morgan = require('morgan');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
// utils
const AppError = require('./utils/appError');
const cronJobs = require('./utils/cronJobs');

// import routers
const authenticationRoutes = require('./routes/authenticationRoutes');
const userRouter = require('./routes/userRoutes');
const listRoutes = require('./routes/listRoutes');
const taskRoutes = require('./routes/taskRoutes');
const workspaceRouter = require('./routes/workspaceRoutes');
const calendarRouter = require('./routes/calendarRoutes');
const eventRouter = require('./routes/eventRoutes');
const boardRouter = require('./routes/boardRoutes');
const fileRouter = require('./routes/fileRoutes');
const skillRouter = require('./routes/skillRoutes');
const notificationRouter = require('./routes/notificationRoutes');
const messageRouter = require('./routes/messageRoutes');
const activityLogRouter = require('./routes/activityLogRoutes');

const fileController = require('./controllers/fileController');

const fs = require('fs');
const path = require('path');

// Tạo thư mục uploads nếu chưa tồn tại
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log('Folder uploads đã được tạo:', uploadDir);
} else {
  console.log('Folder uploads đã tồn tại, không cần tạo mới:', uploadDir);
}

require('./configs/passport-config'); //Import passport configuration

// các middleware
app.use(morgan('dev'));
app.use(cookieParser());

// Cấu hình Express để hỗ trợ UTF-8
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));
app.use(express.json({ charset: 'utf-8' }));

// Set default charset
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});

// CORS configuration
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3800', // Add backend origin for potential self-requests
      'https://web-pro-plan.vercel.app',
      'https://planning-project-web-application.onrender.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'timeout',
      'X-Requested-With',
    ],
    exposedHeaders: ['Authorization', 'Set-Cookie'], // Expose Set-Cookie header
    optionsSuccessStatus: 200, // Trả về 200 cho OPTIONS request
    preflightContinue: false, // Pass control to next handler after successful preflight
  })
);

// Handle preflight requests
app.options('*', cors());

// Thêm middleware session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
    },
  })
);

// Khởi tạo passport
app.use(passport.initialize());
app.use(passport.session());

// ————————————————
// 2) Swagger UI (serve swagger.json at /api-docs)
// ————————————————
// Load your swagger.json (which should reference /auth and /users, not /api/auth)
const swaggerDocument = require('./swagger.json');

// Serve the Swagger UI. Now you can visit http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
console.log(`Swagger UI is available at ${process.env.BACKEND_URL}/api-docs`);

//Initialize admin user ID for sending global (system) notifications
const { initializeAdminId } = require('./utils/admin');
initializeAdminId()
  .then(() => {
    console.log('Admin ID initialized');
  })
  .catch((err) => {
    console.error('Failed to initialize admin ID:', err);
    process.exit(1);
  });
// routing handlers
app.use('/', authenticationRoutes);
app.use('/users', userRouter);
app.use('/calendar', calendarRouter);
app.use('/event', eventRouter);
app.use('/list', listRoutes);
app.use('/task', taskRoutes);
app.use('/workspace', workspaceRouter); //cha
app.use('/workspace/:workspaceId/board', boardRouter); //con
app.use('/files', fileRouter);
app.use('/skills', skillRouter);
app.use('/notification', notificationRouter);
app.use('/message', messageRouter);
app.use('/message', messageRouter);
app.use('/activity', activityLogRouter);
app.get('/auth/google/callback', fileController.handleGoogleAuthCallback);

// Initialize all cron jobs
cronJobs.initializeCronJobs();

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

module.exports = app;
