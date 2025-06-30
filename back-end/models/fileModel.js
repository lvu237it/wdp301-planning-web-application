const mongoose = require('mongoose');
// Quản lý tệp đính kèm
const fileSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Tên file là bắt buộc'] },
    url: { type: String, required: [true, 'URL file là bắt buộc'] },
    googleDriveFileId: { type: String, required: true },
    type: {
      type: String,
      enum: ['image', 'pdf', 'doc', 'other'],
      required: true,
    },
    size: { type: Number, required: [true, 'Kích thước file là bắt buộc'] },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Người tải lên là bắt buộc'],
    },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ eventId: 1 });
fileSchema.index({ taskId: 1 });
fileSchema.index({ googleDriveFileId: 1 });

module.exports = mongoose.model('File', fileSchema);
