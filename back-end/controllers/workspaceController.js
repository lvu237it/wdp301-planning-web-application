const Workspace = require('../models/workspaceModel');

exports.getAllWorkspace = async (req, res) => {
    try {
        const workspaces = await Workspace.find();
        res.status(200).json(workspaces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.createWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;
    const creatorId = req.user?._id || req.body.creator; // Ưu tiên lấy từ token

    // Kiểm tra thông tin bắt buộc
    if (!name || !creatorId) {
      return res.status(400).json({
        message: 'Thiếu thông tin name, calendarId hoặc creator',
        status: 400,
      });
    }

    // Tạo workspace
    const newWorkspace = await Workspace.create({
      name,
      description,
      creator: creatorId,
    });

    return res.status(201).json({
      message: 'Tạo workspace thành công',
      status: 201,
      workspace: newWorkspace,
    });
  } catch (error) {
    console.error('Lỗi khi tạo workspace:', error);
    res.status(500).json({
      message: 'Lỗi server khi tạo workspace',
      status: 500,
      error: error.message,
    });
  }
};

exports.updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const workspace = await Workspace.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace không tồn tại' });
    }

    res.status(200).json({
      message: 'Cập nhật workspace thành công',
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Lỗi server khi cập nhật workspace',
      error: error.message,
    });
  }
}; 



exports.closeWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace không tồn tại' });
    }

    if (workspace.isDeleted) {
      return res.status(400).json({ message: 'Workspace đã bị đóng trước đó' });
    }

    workspace.isDeleted = true;
    workspace.deletedAt = new Date();
    await workspace.save();

    res.status(200).json({
      message: 'Workspace đã được đóng (soft delete)',
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Lỗi server khi đóng workspace',
      error: error.message,
    });
  }
};


exports.deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    const workspace = await Workspace.findByIdAndDelete(id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace không tồn tại hoặc đã bị xóa' });
    }

    res.status(200).json({
      message: 'Workspace đã bị xóa vĩnh viễn',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Lỗi server khi xóa workspace',
      error: error.message,
    });
  }
};




