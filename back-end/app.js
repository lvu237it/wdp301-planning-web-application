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
const workspaceRouter = require('./routes/workspaceRoutes');
const calendarRouter = require('./routes/calendarRoutes');
const eventRouter = require('./routes/eventRoutes');
const boardRouter = require('./routes/boardRoutes');

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

// routing handlers
app.use('/', authenticationRoutes);
app.use('/users', userRouter);
app.use('/workspace', workspaceRouter);
app.use('/calendar', calendarRouter);
app.use('/event', eventRouter);
app.use('/board', boardRouter);
app.use('/workspace/:workspaceId/board', boardRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

module.exports = app;
