const mongoose = require('mongoose');
// Quản lý sự kiện
const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề sự kiện là bắt buộc'],
    },
    description: { type: String },
    calendarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Calendar',
      required: true,
    },
    locationName: {
      //Tên cụ thể, toà, số nhà... (trực tiếp input chính xác tên địa điểm)
      type: String,
    },
    address: {
      // địa chỉ chi tiết thông qua toạ độ
      type: {
        type: String,
        enum: ['Point'], //type: 'Point' chỉ ra rằng coordinates là một mảng [longitude, latitude] đại diện cho một điểm trên bản đồ.
        required: false,
      },
      coordinates: {
        //coordinates: [Number] lưu tọa độ theo thứ tự [longitude, latitude] (theo chuẩn GeoJSON).
        type: [Number],
        index: '2dsphere',
        required: false,
      }, // [longitude, latitude]
      formattedAddress: {
        type: String,
        required: false,
      }, // Địa chỉ đầy đủ từ Geocoding API
      placeId: {
        type: String,
      },
      mapZoomLevel: {
        type: Number,
        default: 15,
      },
    },
    type: {
      type: String,
      enum: ['online', 'offline'],
      required: true,
    },
    onlineUrl: {
      type: String,
    }, // URL cho sự kiện online (nếu type là online)
    meetingCode: {
      type: String,
    }, // Mã cuộc họp (nếu có)
    startDate: {
      type: Date,
      required: [true, 'Thời gian bắt đầu là bắt buộc'],
    },
    endDate: {
      type: Date,
      required: [true, 'Thời gian kết thúc là bắt buộc'],
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    recurrence: {
      //setup sự kiện theo chu kỳ
      type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        default: null,
      },
      interval: {
        type: Number,
        default: 1,
      },
      endDate: {
        type: Date,
      },
    },
    timeZone: {
      type: String,
      default: 'Asia/Ho_Chi_Minh',
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: false,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: false,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer là bắt buộc'],
    },
    participants: [
      // RSVP - phản hồi tham gia sự kiện
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'declined', 'rejected'],
          default: 'pending',
        },
      },
    ],
    reminderSettings: [
      {
        method: { type: String, enum: ['email', 'popup'], default: 'popup' },
        minutes: { type: Number, default: 15 },
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    category: {
      type: String,
      enum: ['workshop', 'meeting', 'party', 'other'],
      default: 'other',
    },
    color: {
      type: String,
      default: '#378006',
    },
    googleEventId: {
      type: String,
      default: null,
    }, // ID của sự kiện trên Google Calendar (nếu có)
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

eventSchema.index({ startDate: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ participants: 1 });
eventSchema.index({ 'address.coordinates': '2dsphere' });
eventSchema.index({ status: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ calendarId: 1 });
eventSchema.index({ boardId: 1 });
module.exports = mongoose.model('Event', eventSchema);
