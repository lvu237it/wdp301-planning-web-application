const Task = require("../models/taskModel");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const sendEmail = require("../utils/sendMail");
const List = require("../models/listModel");
exports.assignTask = async (req, res, next) => {
  try {
    const { id }    = req.params;
    const { email } = req.body;

    // 1) Tìm Task
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy Task'
      });
    }

    // 2) Tìm User theo email
    const user = await User.findOne({ email });
    if (!user || !user.email) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy User hoặc User chưa có email'
      });
    }

    // 3) Gán assignedTo/assignedBy
    task.assignedTo = user._id; //id của người nhận 
    // task.assignedBy = req.user._id;// id của người mời
    await task.save();

    // 4) Gửi mail thông báo
    const subject = `Bạn đã được giao task: "${task.title}"`;
    const deadlineText = task.endDate
      ? new Date(task.endDate).toLocaleString('vi-VN')
      : 'Chưa có hạn chót';
    const html = `
      <h2>Chào ${user.name || user.email},</h2>
      <p>Bạn vừa được giao một công việc mới trên WebPlanPro:</p>
      <ul>
        <li><strong>Tiêu đề:</strong> ${task.title}</li>
        <li><strong>Mô tả:</strong> ${task.description || 'Không có mô tả'}</li>
        <li><strong>Hạn chót:</strong> ${deadlineText}</li>
      </ul>
      <p>Vui lòng đăng nhập để xem chi tiết và cập nhật tiến độ.</p>
      <p>Trân trọng,</p>
      <p>Đội ngũ WebPlanPro</p>
    `;
    await sendEmail(user.email, subject, html);
    console.log(`✉️  Đã gửi mail thông báo tới ${user.email}`);

    // 5) Trả về task đã cập nhật
    res.status(200).json({
      status: 'success',
      data: task
    });
  } catch (err) {
    next(err);
  }
};
exports.notifyAssignedUser = async (task) => {
  try {
    const assignedUser = await User.findById(task.assignedTo).select(
      "email name"
    );
    if (!assignedUser || !assignedUser.email) {
      console.warn(`User không tồn tại hoặc chưa có email: ${task.assignedTo}`);
      return;
    }
    const subject = `Bạn đã được giao task mới: "${task.title}"`;
    const deadlineText = task.deadline
      ? new Date(task.endDate).toLocaleString("vi-VN")
      : "Chưa có hạn chót";

    const htmlContent = `
      <h2>Chào ${assignedUser.name || "bạn"},</h2>
      <p>Bạn vừa được giao một công việc mới trên WebPlanPro:</p>
      <ul>
        <li><strong>Tiêu đề:</strong> ${task.title}</li>
        <li><strong>Mô tả:</strong> ${task.description || "Không có mô tả"}</li>
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
    console.error("Lỗi khi gửi email thông báo task:", error);
  }
};

exports.getAllTask = async (req, res) => {
  try {
    const tasks = await Task.find({ isDeleted: false }).sort("createdAt");
    res.status(200).json({
      status: "success",
      results: tasks.length,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
exports.getTasksByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        status: "fail",
        message: "boardId không hợp lệ",
      });
    }
    const tasks = await Task.find({ boardId, isDeleted: false });
    res.status(200).json({
      status: "success",
      results: tasks.length,
      data: tasks,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getTaskId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "fail",
        message: "ID không hợp lệ",
      });
    }

    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy task",
      });
    }

    res.status(200).json({
      status: "success",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
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
      startDate,
      endDate,
      allDay,
      recurrence,
      reminderSettings,
      checklist,
      documents,
    } = req.body;

    if (!title || !boardId || !listId) {
      return res.status(400).json({
        status: "fail",
        message:
          "title, calendarId, boardId, listId, assignedTo và assignedBy là bắt buộc",
      });
    }

    const requiredIds = { boardId, listId };
    for (const [key, value] of Object.entries(requiredIds)) {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({
          status: "fail",
          message: `${key} không hợp lệ`,
        });
      }
    }
    if (workspaceId && !mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res
        .status(400)
        .json({ status: "fail", message: "workspaceId không hợp lệ" });
    }
    if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
      return res
        .status(400)
        .json({ status: "fail", message: "eventId không hợp lệ" });
    }
    const now = new Date();
    const newTask = await Task.create({
      title,
      description: description || "",
      calendarId,
      workspaceId: workspaceId || null,
      boardId,
      listId,
      eventId: eventId || null,
      assignedTo: assignedTo || null,
      assignedBy: assignedBy || null,
      startDate: startDate ? new Date(startDate) : now,
      endDate: endDate ? new Date(endDate) : now,
      allDay: typeof allDay === "boolean" ? allDay : false,
      recurrence: recurrence || null,
      reminderSettings: Array.isArray(reminderSettings) ? reminderSettings : [],
      checklist: Array.isArray(checklist) ? checklist : [],
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
      status: "success",
      data: newTask,
    });
  } catch (error) {
    console.error("Error while creating task:", error);
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi tạo task",
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      startDate,
      endDate,
      allDay,
      recurrence,
      reminderSettings,
      checklist,
      documents,
      progress
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status:'fail', message:'ID không hợp lệ' });
    }
    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ status:'fail', message:'Không tìm thấy task' });
    }

    if (typeof title === 'string')           task.title       = title.trim();
    if (typeof description === 'string')     task.description = description;
    if (startDate !== undefined)             task.startDate   = new Date(startDate);
    if (endDate   !== undefined)             task.endDate     = new Date(endDate);
    if (allDay    !== undefined)             task.allDay      = allDay;
    if (recurrence !== undefined)            task.recurrence  = recurrence;
    if (Array.isArray(reminderSettings))     task.reminderSettings = reminderSettings;
    if (Array.isArray(checklist))            task.checklist       = checklist;
    if (Array.isArray(documents))            task.documents       = documents;
    if (typeof progress === 'number')        task.progress        = progress;

    const updatedTask = await task.save();

    res.status(200).json({ status:'success', data:updatedTask });
  } catch (error) {
    console.error('Error while updating task:', error);
    res.status(500).json({ status:'error', message:'Có lỗi xảy ra khi cập nhật task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "fail",
        message: "ID không hợp lệ",
      });
    }

    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy task",
      });
    }

    const { listId } = task;

    // 2. Xóa task (hard delete)
    await Task.deleteOne({ _id: id });

    // 3. Cập nhật lại mảng tasks trong List: pull id của task vừa xóa
    await List.findByIdAndUpdate(
      listId,
      { $pull: { tasks: task._id } },
      { new: true }
    );

    res.status(200).json({
      status: "success",
      message: "Xóa task thành công và cập nhật List.tasks",
    });
  } catch (error) {
    console.error("Error while deleting task:", error);
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi xóa task",
    });
  }
};
