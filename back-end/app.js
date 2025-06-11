const express = require('express');
const app = express();

const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const auth = require('./utils/auth');

// utils
const AppError = require('./utils/appError');
const frontendURL = process.env.FRONTEND_URL;
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

const fileController = require('./controllers/fileController');

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

// ————————————————
// 2) Swagger UI (serve swagger.json at /api-docs)
// ————————————————
// Load your swagger.json (which should reference /auth and /users, not /api/auth)
const swaggerDocument = require('./swagger.json');

// Serve the Swagger UI. Now you can visit http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
console.log(`Swagger UI is available at ${process.env.BACKEND_URL}/api-docs`);

// routing handlers
app.use('/', authenticationRoutes);
app.use('/users', userRouter);
app.use('/calendar', calendarRouter);
app.use('/event', eventRouter);
app.use('/list', listRoutes);
app.use('/task', taskRoutes);
app.use('/workspace', workspaceRouter);
app.use('/workspace/:workspaceId/board', boardRouter);
app.use('/files', fileRouter);
app.use('/auth/google/callback', fileController.handleGoogleAuthCallback);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

module.exports = app;
