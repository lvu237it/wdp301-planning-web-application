const Task = require('../models/taskModel');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendMail');
const List = require('../models/listModel');

const notifyAssignedUser = async (task) => {
  try {
    const assignedUser = await User.findById(task.assignedTo).select('email name');
    if (!assignedUser || !assignedUser.email) {
      console.warn(`User không tồn tại hoặc chưa có email: ${task.assignedTo}`);
      return;
    }
    const subject = `Bạn đã được giao task mới: "${task.title}"`;
    const deadlineText = task.deadline
      ? new Date(task.deadline).toLocaleString('vi-VN')
      : 'Chưa có hạn chót';

    const htmlContent = `
      <h2>Chào ${assignedUser.name || 'bạn'},</h2>
      <p>Bạn vừa được giao một công việc mới trên WebPlanPro:</p>
      <ul>
        <li><strong>Tiêu đề:</strong> ${task.title}</li>
        <li><strong>Mô tả:</strong> ${task.description || 'Không có mô tả'}</li>
        <li><strong>Hạn chót:</strong> ${deadlineText}</li>
        <li><strong>Board ID:</strong> ${task.boardId}</li>
        <li><strong>List ID:</strong> ${task.listId}</li>
      </ul>
      <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết và cập nhật tiến độ.</p>
      <p>Trân trọng,<br/>Đội ngũ WebPlanPro</p>
    `;

    await sendEmail(assignedUser.email, subject, htmlContent);
    console.log(`Đã gửi email thông báo tới ${assignedUser.email}`);
  } catch (error) {
    console.error('Lỗi khi gửi email thông báo task:', error);
  }
};




exports.getAllTask = async (req, res) => {
  try {
    const tasks = await Task.find({ isDeleted: false }).sort('createdAt');
    res.status(200).json({
      status: 'success',
      results: tasks.length,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
exports.getTasksByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'boardId không hợp lệ'
      });
    }
    const tasks = await Task.find({ boardId, isDeleted: false });
    res.status(200).json({
      status: 'success',
      results: tasks.length,
      data: tasks
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getTaskId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'ID không hợp lệ',
      });
    }

    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy task',
      });
    }

    res.status(200).json({
      status: 'success',
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      calendarId,
      workspaceId,
      boardId,
      listId,
      eventId,
      assignedTo,
      assignedBy,
      deadline,
      recurrence,
      reminderSettings,
      checklist,
      labels,
      documents,
    } = req.body;

    if (!title || !calendarId || !boardId || !listId || !assignedTo || !assignedBy) {
      return res.status(400).json({
        status: 'fail',
        message: 'title, calendarId, boardId, listId, assignedTo và assignedBy là bắt buộc',
      });
    }

    const requiredIds = { calendarId, boardId, listId, assignedTo, assignedBy };
    for (const [key, value] of Object.entries(requiredIds)) {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({
          status: 'fail',
          message: `${key} không hợp lệ`,
        });
      }
    }
    if (workspaceId && !mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ status: 'fail', message: 'workspaceId không hợp lệ' });
    }
    if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ status: 'fail', message: 'eventId không hợp lệ' });
    }

    const newTask = await Task.create({
      title,
      description: description || '',
      calendarId,
      workspaceId: workspaceId || null,
      boardId,
      listId,
      eventId: eventId || null,
      assignedTo,
      assignedBy,
      deadline: deadline || null,
      recurrence: recurrence || null,
      reminderSettings: Array.isArray(reminderSettings) ? reminderSettings : [],
      checklist: Array.isArray(checklist) ? checklist : [],
      labels: Array.isArray(labels) ? labels : [],
      documents: Array.isArray(documents) ? documents : [],
      isDeleted: false,
      deletedAt: null,
    });

    await List.findByIdAndUpdate(
      listId,
      { $push: { tasks: newTask._id } },
      { new: true } 
    );

    res.status(201).json({
      status: 'success',
      data: newTask,
    });
  } catch (error) {
    console.error('Error while creating task:', error);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra khi tạo task',
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      calendarId,
      workspaceId,
      boardId,
      listId,
      eventId,
      assignedTo,
      assignedBy,
      deadline,
      recurrence,
      reminderSettings,
      checklist,
      labels,
      documents,
      progress,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'ID không hợp lệ',
      });
    }

    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy task',
      });
    }

    const oldAssignedTo = task.assignedTo.toString();

    const idFields = { calendarId, workspaceId, boardId, listId, eventId, assignedTo, assignedBy };
    for (const [key, value] of Object.entries(idFields)) {
      if (value !== undefined && value !== null) {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return res.status(400).json({
            status: 'fail',
            message: `${key} không hợp lệ`,
          });
        }
      }
    }

    if (typeof title === 'string' && title.trim() !== '') {
      task.title = title.trim();
    }
    if (typeof description === 'string') {
      task.description = description;
    }
    if (calendarId) {
      task.calendarId = calendarId;
    }
    if (workspaceId !== undefined) {
      task.workspaceId = workspaceId;
    }
    if (boardId) {
      task.boardId = boardId;
    }
    if (listId) {
      task.listId = listId;
    }
    if (eventId !== undefined) {
      task.eventId = eventId;
    }
    if (assignedTo) {
      task.assignedTo = assignedTo;
    }
    if (assignedBy) {
      task.assignedBy = assignedBy;
    }
    if (deadline !== undefined) {
      task.deadline = deadline;
    }
    if (recurrence !== undefined) {
      task.recurrence = recurrence;
    }
    if (Array.isArray(reminderSettings)) {
      task.reminderSettings = reminderSettings;
    }
    if (Array.isArray(checklist)) {
      task.checklist = checklist;
    }
    if (Array.isArray(labels)) {
      task.labels = labels;
    }
    if (Array.isArray(documents)) {
      task.documents = documents;
    }
    if (typeof progress === 'number') {
      task.progress = progress;
    }

    const updatedTask = await task.save();

    const newAssignedTo = updatedTask.assignedTo.toString();
    if (assignedTo && newAssignedTo !== oldAssignedTo) {
      await notifyAssignedUser(updatedTask);
    }

    res.status(200).json({
      status: 'success',
      data: updatedTask,
    });
  } catch (error) {
    console.error('Error while updating task:', error);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra khi cập nhật task',
    });
  }
};


exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'ID không hợp lệ',
      });
    }

    // 1. Tìm task để lấy listId trước khi xóa
    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy task',
      });
    }

    const { listId } = task;

    // 2. Xóa task (hard delete)
    await Task.deleteOne({ _id: id });
    // Nếu bạn muốn soft-delete, thay bằng:
    // await Task.findByIdAndUpdate(id, { isDeleted: true, deletedAt: Date.now() });

    // 3. Cập nhật lại mảng tasks trong List: pull id của task vừa xóa
    await List.findByIdAndUpdate(
      listId,
      { $pull: { tasks: task._id } },
      { new: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Xóa task thành công và cập nhật List.tasks',
    });
  } catch (error) {
    console.error('Error while deleting task:', error);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra khi xóa task',
    });
  }
};
