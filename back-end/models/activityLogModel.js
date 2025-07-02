const mongoose = require('mongoose');
// Ghi lại lịch sử hoạt động trong board
const activityLogSchema = new mongoose.Schema({
  boardId: {
    //Phạm vi log: board cụ thể với các list, task, message trong từng task
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
  },
  userId: {
    //người thực hiện hành động được ghi lại trong bản ghi log
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  //log các sự việc liên quan tới task, message, list (các model thường xuyên tương tác và cần theo dõi chi tiết)
  action: {
    type: String,
    required: true,
    enum: [
      // Task-related actions
      'task_created',
      'task_updated',
      'task_deleted',
      'task_assigned',
      'task_unassigned',
      'task_checklist_updated',
      'task_document_added',
      'task_document_removed',
      'task_document_renamed',
      // Message-related actions
      'message_sent',
      'message_updated',
      'message_deleted',
      'message_pinned',
      'message_unpinned',
      // List-related actions
      'list_created',
      'list_updated',
      'list_deleted',
      'list_task_moved',
    ],
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
  isVisible: {
    //kiểm soát quyền xem.
    // isVisible: true // có thể hiển thị cho tất cả thành viên trong board
    // isVisible: false // hiển thị chỉ dành cho admin. //Example: task_deleted, list_deleted, message_deleted only show for admin
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
});

activityLogSchema.index({ boardId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ targetType: 1, targetId: 1 });
activityLogSchema.index({ boardId: 1, isVisible: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
