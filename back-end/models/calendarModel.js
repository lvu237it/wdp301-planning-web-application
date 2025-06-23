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
      enum: ['user', 'board'], //chuyển từ workpsace sang board, vì cần phân biệt rõ từng calendar cho riêng từng board
      required: [
        true,
        'Owner type - Lịch cần xác định thuộc về user hoặc board',
      ],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Lịch cần thuộc về 1 người dùng hoặc board cụ thể'],
      refPath: 'ownerType',
    },
    events: [
      //các sự kiện cá nhân tạo ra hoặc sự kiện của 1 board tạo ra
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
      },
    ],
    tasks: [
      //Các task từ các list của board - tách riêng, ko phụ thuộc vào event
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
