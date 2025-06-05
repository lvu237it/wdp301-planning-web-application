const mongoose = require('mongoose');
// Quản lý lịch cá nhân/nhóm
const calendarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên lịch là bắt buộc'],
    },
    description: {
      type: String,
    },
    ownerType: {
      type: String,
      enum: ['user', 'workspace'],
      required: [
        true,
        'Owner type - Lịch cần xác định thuộc về user hoặc workspace',
      ],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Lịch cần thuộc về 1 người dùng hoặc nhóm cụ thể'],
      refPath: 'ownerType',
    },
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
      },
    ],
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    defaultView: {
      type: String,
      enum: [
        'dayGridMonth',
        'dayGridWeek',
        'dayGridDay',
        'timeGridWeek',
        'timeGridDay',
        'listWeek',
        'listMonth',
        'listDay',
        'listYear',
        'multiMonthYear',
      ],
      default: 'dayGridMonth',
    },
    timeZone: {
      type: String,
      default: 'Asia/Ho_Chi_Minh',
    },
    color: {
      type: String,
      default: '#378006',
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

calendarSchema.index({ ownerId: 1, ownerType: 1 });
calendarSchema.index({ name: 1 });
module.exports = mongoose.model('Calendar', calendarSchema);
