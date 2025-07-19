const Task = require("../models/taskModel");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const sendEmail = require("../utils/sendMail");
const List = require("../models/listModel");
const NotificationService = require("../services/NotificationService");
const { getAdminId } = require("../utils/admin");
exports.assignTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const userId = req.user._id;

    // 1) Tìm Task
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy Task",
      });
    }

    // 2) Tìm User theo email
    const user = await User.findOne({ email });
    if (!user || !user.email) {
      return res.status(404).json({
        status: "fail",
        message: "Không tìm thấy User hoặc User chưa có email",
      });
    }

    // Store previous assignee for notification
    const previousAssignee = task.assignedTo;

    // Update assignment
    task.assignedTo = user._id;
    task._userId = userId; // For activity logging
    await task.save();

    // Send email notification
    const subject = `Bạn đã được giao task: "${task.title}"`;
    const deadlineText = task.endDate
      ? new Date(task.endDate).toLocaleString("vi-VN")
      : "Chưa có ngày kết thúc";
      const startdeadline = task.startDate
      ? new Date(task.startDate).toLocaleString("vi-VN")
      : "Chưa có ngày bắt đầu";
    const html = `
      <h2>Chào ${user.name || user.email},</h2>
      <p>Bạn vừa được giao một công việc mới trên WebPlanPro:</p>
      <ul>
        <li><strong>Tiêu đề:</strong> ${task.title}</li>
        <li><strong>Mô tả:</strong> ${task.description || "Không có mô tả"}</li>
        <li><strong>Ngày bắt đầu:</strong> ${startdeadline}</li>
        <li><strong>Ngày kết thúc:</strong> ${deadlineText}</li>
      </ul>
      <p>Vui lòng đăng nhập để xem chi tiết và cập nhật tiến độ.</p>
      <p>Trân trọng,</p>
      <p>Đội ngũ WebPlanPro</p>
    `;
    await sendEmail(user.email, subject, html);
    console.log(`✉️  Đã gửi mail thông báo tới ${user.email}`);

    // Send notification to new assignee
    try {
      await NotificationService.createPersonalNotification({
        title: "Nhiệm vụ mới được giao",
        content: `Bạn được giao nhiệm vụ "${task.title}"`,
        type: "task_assigned",
        targetUserId: user._id,
        targetWorkspaceId: task.workspaceId,
        createdBy: userId,
        taskId: task._id,
      });
    } catch (notificationError) {
      console.warn(
        "Failed to send task assignment notification:",
        notificationError
      );
    }

    // Send notification to assigner (person who assigned the task)
    try {
      await NotificationService.createPersonalNotification({
        title: "Đã giao nhiệm vụ thành công",
        content: `Bạn đã giao nhiệm vụ "${task.title}" cho ${
          user.fullname || user.username || user.email
        }`,
        type: "task_assignment_confirmed",
        targetUserId: userId,
        targetWorkspaceId: task.workspaceId,
        createdBy: userId,
        taskId: task._id,
      });
    } catch (notificationError) {
      console.warn(
        "Failed to send task assignment confirmation:",
        notificationError
      );
    }

    // Send notification to previous assignee if task was reassigned
    if (
      previousAssignee &&
      previousAssignee.toString() !== user._id.toString()
    ) {
      try {
        await NotificationService.createPersonalNotification({
          title: "Nhiệm vụ đã được chuyển giao",
          content: `Nhiệm vụ "${task.title}" đã được chuyển giao cho người khác`,
          type: "task_unassigned",
          targetUserId: previousAssignee,
          targetWorkspaceId: task.workspaceId,
          createdBy: userId,
          taskId: task._id,
        });
      } catch (notificationError) {
        console.warn(
          "Failed to send task unassignment notification:",
          notificationError
        );
      }
    }

    res.status(200).json({
      status: "success",
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

// Xóa người được giao việc
exports.unassignTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check ID validity
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "fail", message: "ID không hợp lệ" });
    }

    // Get task
    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res
        .status(404)
        .json({ status: "fail", message: "Không tìm thấy task" });
    }

    // Store previous assignee for notification
    const previousAssignee = task.assignedTo;

    // Remove assignment
    task.assignedTo = null;
    task._userId = userId; // For activity logging
    await task.save();

    // Send notification to previous assignee
    if (previousAssignee) {
      try {
        await NotificationService.createPersonalNotification({
          title: "Nhiệm vụ đã được hủy giao",
          content: `Nhiệm vụ "${task.title}" đã được hủy giao`,
          type: "task_unassigned",
          targetUserId: previousAssignee,
          targetWorkspaceId: task.workspaceId,
          createdBy: userId,
          taskId: task._id,
        });
      } catch (notificationError) {
        console.warn(
          "Failed to send task unassignment notification:",
          notificationError
        );
      }

      // Send notification to person who unassigned the task
      try {
        await NotificationService.createPersonalNotification({
          title: "Đã hủy giao nhiệm vụ thành công",
          content: `Bạn đã hủy giao nhiệm vụ "${task.title}"`,
          type: "task_unassignment_confirmed",
          targetUserId: userId,
          targetWorkspaceId: task.workspaceId,
          createdBy: userId,
          taskId: task._id,
        });
      } catch (notificationError) {
        console.warn(
          "Failed to send task unassignment confirmation:",
          notificationError
        );
      }
    }

    // Return updated task with populated fields
    const updated = await Task.findById(id)
      .populate("assignedTo", "username email avatar")
      .populate("assignedBy", "username email avatar");

    res.status(200).json({ status: "success", data: updated });
  } catch (err) {
    next(err);
  }
};

exports.notifyAssignedUser = async (task) => {
  try {
    // Kiểm tra task có assignedTo không
    if (!task.assignedTo) {
      console.log("Task chưa được gán cho ai, bỏ qua gửi email thông báo");
      return;
    }

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
    // const tasks = await Task.find({ boardId, isDeleted: false });
    const tasks = await Task.find({ boardId, isDeleted: false })
      .populate("assignedTo", "username email avatar")
      .populate("assignedBy", "username email avatar")
      .populate("documents", "name url type size");
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

    // const task = await Task.findOne({ _id: id, isDeleted: false });
    const task = await Task.findOne({ _id: id, isDeleted: false })
      .populate("assignedTo", "username email avatar")
      .populate("assignedBy", "username email avatar")
      .populate("documents", "name url type size");
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
  const session = await mongoose.startSession();
  session.startTransaction();

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

    const userId = req.user._id;

    if (!title || !boardId || !listId) {
      throw new Error("title, boardId, listId là bắt buộc");
    }

    const requiredIds = { boardId, listId };
    for (const [key, value] of Object.entries(requiredIds)) {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`${key} không hợp lệ`);
      }
    }

    if (workspaceId && !mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new Error("workspaceId không hợp lệ");
    }
    if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
      throw new Error("eventId không hợp lệ");
    }

    const now = new Date();

    // Create task with _userId for logging
    const taskData = {
      title,
      description: description || "",
      calendarId,
      workspaceId: workspaceId || null,
      boardId,
      listId,
      eventId: eventId || null,
      assignedTo: assignedTo || null,
      assignedBy: userId,
      startDate: startDate ? new Date(startDate) : now,
      endDate: endDate ? new Date(endDate) : now,
      allDay: typeof allDay === "boolean" ? allDay : false,
      recurrence: recurrence || null,
      reminderSettings: Array.isArray(reminderSettings) ? reminderSettings : [],
      checklist: Array.isArray(checklist) ? checklist : [],
      documents: Array.isArray(documents) ? documents : [],
      isDeleted: false,
      deletedAt: null,
    };

    const newTask = new Task(taskData);
    newTask._userId = userId; // For activity logging
    await newTask.save({ session });

    // Update list
    await List.findByIdAndUpdate(
      listId,
      { $push: { tasks: newTask._id } },
      { session }
    );

    // Send notification if task is assigned to someone
    if (assignedTo && assignedTo !== userId.toString()) {
      try {
        await NotificationService.createPersonalNotification({
          title: "Nhiệm vụ mới được giao",
          content: `Bạn được giao nhiệm vụ "${title}"`,
          type: "task_assigned",
          targetUserId: assignedTo,
          targetWorkspaceId: workspaceId,
          createdBy: userId,
          taskId: newTask._id,
        });
      } catch (notificationError) {
        console.warn(
          "Failed to send task assignment notification:",
          notificationError
        );
      }
    }

    // Send notification to task creator
    try {
      await NotificationService.createPersonalNotification({
        title: "Tạo nhiệm vụ thành công",
        content: `Bạn đã tạo thành công nhiệm vụ "${title}"${
          assignedTo && assignedTo !== userId.toString()
            ? " và giao cho thành viên khác"
            : ""
        }`,
        type: "task_created",
        targetUserId: userId,
        targetWorkspaceId: workspaceId,
        createdBy: userId,
        taskId: newTask._id,
      });
    } catch (notificationError) {
      console.warn(
        "Failed to send task creation notification:",
        notificationError
      );
    }

    await session.commitTransaction();
    res.status(201).json({
      status: "success",
      data: newTask,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error while creating task:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Có lỗi xảy ra khi tạo task",
    });
  } finally {
    session.endSession();
  }
};

// update task
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
      progress,
    } = req.body;

    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: "fail", message: "ID không hợp lệ" });
    }

    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ status: "fail", message: "Không tìm thấy task" });
    }

    // Store old values for comparison
    const oldStartDate = task.startDate;
    const oldEndDate = task.endDate;
    const oldTitle = task.title;
    const oldDescription = task.description;
    const oldProgress = task.progress;

    // Update fields
    if (typeof title === "string") task.title = title.trim();
    if (typeof description === "string") task.description = description;
    if (startDate !== undefined) task.startDate = new Date(startDate);
    if (endDate !== undefined) task.endDate = new Date(endDate);
    if (allDay !== undefined) task.allDay = allDay;
    if (recurrence !== undefined) task.recurrence = recurrence;
    if (Array.isArray(reminderSettings)) task.reminderSettings = reminderSettings;
    if (Array.isArray(checklist)) task.checklist = checklist;
    if (Array.isArray(documents)) task.documents = documents;
    if (typeof progress === "number") task.progress = progress;

    // Set userId for activity logging
    task._userId = userId;
    const updatedTask = await task.save();

    // Check for significant changes and send notifications
    let hasSignificantChanges = false;
    let changeDetails = [];

    // Check for title change
    if (typeof title === "string" && title.trim() !== oldTitle) {
      hasSignificantChanges = true;
      changeDetails.push("tiêu đề");
    }

    // Check for description change
    if (typeof description === "string" && description !== oldDescription) {
      hasSignificantChanges = true;
      changeDetails.push("mô tả");
    }

    // Check for progress change
    if (typeof progress === "number" && progress !== oldProgress) {
      hasSignificantChanges = true;
      changeDetails.push("tiến độ");
    }

    // Check for startDate change (compare by millisecond)
    if (
      startDate &&
      oldStartDate &&
      new Date(oldStartDate).getTime() !== new Date(startDate).getTime()
    ) {
      hasSignificantChanges = true;
      changeDetails.push("ngày bắt đầu");
    }

    // Check for endDate change (compare by millisecond)
    if (
      endDate &&
      oldEndDate &&
      new Date(oldEndDate).getTime() !== new Date(endDate).getTime()
    ) {
      hasSignificantChanges = true;
      changeDetails.push("ngày kết thúc");
    }

    // Send notifications if there are significant changes and task is assigned
    if (hasSignificantChanges && task.assignedTo) {
      // Send notification to assignee
      if (task.assignedTo.toString() !== userId.toString()) {
        try {
          await NotificationService.createPersonalNotification({
            title: "Cập nhật nhiệm vụ",
            content: `Nhiệm vụ "${task.title}" đã được cập nhật (${changeDetails.join(", ")})`,
            type: "task_updated",
            targetUserId: task.assignedTo,
            targetWorkspaceId: task.workspaceId,
            createdBy: userId,
            taskId: task._id,
          });
        } catch (notificationError) {
          console.warn("Failed to send task update notification to assignee:", notificationError);
        }
      }

      // Send notification to assigner
      if (
        task.assignedBy &&
        task.assignedBy.toString() !== userId.toString() &&
        task.assignedBy.toString() !== task.assignedTo.toString()
      ) {
        try {
          await NotificationService.createPersonalNotification({
            title: "Cập nhật nhiệm vụ đã giao",
            content: `Nhiệm vụ "${task.title}" mà bạn đã giao đã được cập nhật (${changeDetails.join(", ")})`,
            type: "task_updated",
            targetUserId: task.assignedBy,
            targetWorkspaceId: task.workspaceId,
            createdBy: userId,
            taskId: task._id,
          });
        } catch (notificationError) {
          console.warn("Failed to send task update notification to assigner:", notificationError);
        }
      }

      // Send email if startDate or endDate changed
      if (changeDetails.includes("ngày bắt đầu") || changeDetails.includes("ngày kết thúc")) {
        try {
          const assignedUser = await User.findById(task.assignedTo).select("email name");
          if (assignedUser?.email) {
            const startText = new Date(task.startDate).toLocaleString("vi-VN");
            const endText = new Date(task.endDate).toLocaleString("vi-VN");
            const html = `
              <h2>Chào ${assignedUser.name || assignedUser.email},</h2>
              <p>Thời gian của task bạn đang nhận <strong>"${task.title}"</strong> đã được thay đổi.</p>
              <ul>
                <li><strong>Mô tả:</strong> ${task.description || "Không có mô tả"}</li>
                <li><strong>Ngày bắt đầu:</strong> ${startText}</li>
                <li><strong>Ngày kết thúc:</strong> ${endText}</li>
              </ul>
              <p>Vui lòng kiểm tra lại hệ thống để nắm thông tin mới nhất.</p>
              <p>Trân trọng,<br/>Đội ngũ WebPlanPro</p>
            `;
            await sendEmail(
              assignedUser.email,
              `Cập nhật thời gian cho task "${task.title}"`,
              html
            );
            console.log(`Gửi mail thay đổi thời gian cho: ${assignedUser.email}`);
          } else {
            console.warn("Không tìm thấy email của assignedUser, bỏ qua gửi mail");
          }
        } catch (mailError) {
          console.error("Lỗi khi gửi email thay đổi thời gian:", mailError);
        }
      }
    }

    res.status(200).json({ status: "success", data: updatedTask });
  } catch (error) {
    console.error("Error while updating task:", error);
    res.status(500).json({ status: "error", message: "Có lỗi xảy ra khi cập nhật task" });
  }
};

exports.deleteTask = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID không hợp lệ");
    }

    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      throw new Error("Không tìm thấy task");
    }

    const { listId } = task;

    // Soft delete with userId for logging
    await Task.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      },
      { session, _userId: userId }
    );

    // Update list
    await List.findByIdAndUpdate(
      listId,
      { $pull: { tasks: task._id } },
      { session }
    );

    // Send notification to assigned user if task was assigned
    if (task.assignedTo && task.assignedTo.toString() !== userId.toString()) {
      try {
        await NotificationService.createPersonalNotification({
          title: "Nhiệm vụ đã bị xóa",
          content: `Nhiệm vụ "${task.title}" mà bạn được giao đã bị xóa`,
          type: "task_deleted",
          targetUserId: task.assignedTo,
          targetWorkspaceId: task.workspaceId,
          createdBy: userId,
          taskId: task._id,
        });
      } catch (notificationError) {
        console.warn(
          "Failed to send task deletion notification:",
          notificationError
        );
      }
    }

    await session.commitTransaction();
    res.status(200).json({
      status: "success",
      message: "Xóa task thành công",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error while deleting task:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Có lỗi xảy ra khi xóa task",
    });
  } finally {
    session.endSession();
  }
};

// Update checklist item specifically
exports.updateChecklistItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemIndex, completed, title } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "fail", message: "ID không hợp lệ" });
    }

    const task = await Task.findOne({ _id: id, isDeleted: false });
    if (!task) {
      return res
        .status(404)
        .json({ status: "fail", message: "Không tìm thấy task" });
    }

    // Check permission - user must be assignee, assigner, or admin
    const isAssignedTo = task.assignedTo && task.assignedTo.equals(userId);
    const isAssignedBy = task.assignedBy && task.assignedBy.equals(userId);

    if (!isAssignedTo && !isAssignedBy) {
      return res.status(403).json({
        status: "fail",
        message: "Bạn không có quyền cập nhật checklist của task này",
      });
    }

    // Validate itemIndex
    if (
      typeof itemIndex !== "number" ||
      itemIndex < 0 ||
      itemIndex >= task.checklist.length
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Index checklist item không hợp lệ",
      });
    }

    const checklistItem = task.checklist[itemIndex];
    const oldCompleted = checklistItem.completed;
    const itemTitle = title || checklistItem.title;

    // Update the specific checklist item
    if (typeof completed === "boolean") {
      task.checklist[itemIndex].completed = completed;
      if (completed) {
        task.checklist[itemIndex].completedAt = new Date();
      } else {
        task.checklist[itemIndex].completedAt = undefined;
      }
    }

    if (title && typeof title === "string") {
      task.checklist[itemIndex].title = title.trim();
    }

    // Set userId for activity logging
    task._userId = userId;

    // Store old checklist for comparison in middleware
    task.$__.checklist = JSON.parse(JSON.stringify(task.checklist));
    task.$__.checklist[itemIndex].completed = oldCompleted;

    const updatedTask = await task.save();

    // Send notification if item was completed by assignee
    if (
      typeof completed === "boolean" &&
      completed !== oldCompleted &&
      completed === true &&
      task.assignedTo &&
      task.assignedBy &&
      !task.assignedBy.equals(userId)
    ) {
      try {
        await NotificationService.createPersonalNotification({
          title: "Tiến độ nhiệm vụ được cập nhật",
          content: `Nhiệm vụ con "${itemTitle}" trong task "${task.title}" đã được hoàn thành`,
          type: "task_progress_updated",
          targetUserId: task.assignedBy,
          targetWorkspaceId: task.workspaceId,
          createdBy: userId,
          taskId: task._id,
        });
      } catch (notificationError) {
        console.warn(
          "Failed to send checklist update notification:",
          notificationError
        );
      }
    }

    res.status(200).json({
      status: "success",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error while updating checklist item:", error);
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi cập nhật checklist",
    });
  }
};

// POST body: [{ _id, listId, position }, …]
exports.reorderTasks = async (req, res, next) => {
  const updates = req.body;
  try {
    await Task.bulkWrite(
      updates.map((t) => ({
        updateOne: {
          filter: { _id: t._id },
          update: { listId: t.listId, position: t.position },
        },
      }))
    );
    res.status(200).json({ success: true, data: updates });
  } catch (err) {
    next(err);
  }
};

exports.getTasksByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: "fail",
        message: "userId không hợp lệ",
      });
    }

    const tasks = await Task.find({
      assignedTo: userId,
      isDeleted: false,
    }).select("title startDate endDate assignedTo");

    res.status(200).json({
      status: "success",
      results: tasks.length,
      tasks,
    });
  } catch (err) {
    console.error("Error in getTasksByUser:", err);
    res.status(500).json({
      status: "error",
      message: "Có lỗi xảy ra khi lấy danh sách task theo user",
    });
  }
};

