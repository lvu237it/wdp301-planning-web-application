const mongoose = require('mongoose');
// Ghi lại lịch sử hoạt động trong board
const activityLogSchema = new mongoose.Schema(
  {
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      //log các sự việc liên quan tới task, message, list (các model thường xuyên tương tác và cần theo dõi chi tiết)
      type: String,
      required: true,
      // enum: [
      //   'task_created',
      //   'task_updated',
      //   'message_sent',
      //   'list_created',
      // ],
    },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    /*----------- giải thích ---------------
    // targetId: Là một ObjectId tham chiếu đến một document cụ thể. (ở đây có thể tham chiếu tới nhiều collection)
    targetId ObjectId
    - (ref: Task when targetType: 'task')
    - (ref: Message when targetType: 'message')
    - (ref: List when targetType: 'list')
    */
    targetType: { type: String, enum: ['task', 'message', 'list'] },
    details: { type: String },
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ boardId: 1, timestamp: -1 });
activityLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
