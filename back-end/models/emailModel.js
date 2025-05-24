const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema(
  {
    sender: {
      email: {
        type: String,
        default: 'no-reply@yourapp.com',
      },
      name: {
        type: String,
        default: 'Hệ thống YourApp',
      },
    },
    recipients: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed'],
          default: 'pending',
        },
      },
    ],
    subject: {
      type: String,
      required: true,
    },
    body: {
      text: {
        type: String,
        required: true,
      },
      html: {
        type: String,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    sentAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

emailSchema.index({ notificationId: 1 });
emailSchema.index({ eventId: 1 });
emailSchema.index({ taskId: 1 });
emailSchema.index({ 'recipients.userId': 1, createdAt: -1 });

module.exports = mongoose.model('Email', emailSchema);
