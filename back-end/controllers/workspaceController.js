const mongoose = require('mongoose');
const Workspace = require('../models/workspaceModel');
const Membership = require('../models/memberShipModel');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendMail');
const crypto = require('crypto');

// lay tat ca workspace
exports.getAllWorkspace = async (req, res) => {
  try {
    const workspaces = await Workspace.find();
    res.status(200).json(workspaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Tạo workspace
exports.createWorkspace = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, description } = req.body;
    const creatorId = req.user._id;

    if (!name || !creatorId) {
      throw new Error('Thiếu thông tin name hoặc creator');
    }

    // 1. Tạo workspace
    const [newWorkspace] = await Workspace.create(
      [{ name, description, creator: creatorId }],
      { session }
    );

    // 2. Tạo membership cho creator
    const [membership] = await Membership.create(
      [
        {
          workspaceId: newWorkspace._id,
          userId: creatorId,
          role: 'creatorWorkspace',
          invitationStatus: 'accepted',
        },
      ],
      { session }
    );

    // 3. Gán membership vào workspace
    newWorkspace.members.push(membership._id);
    await newWorkspace.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Tạo workspace và thành viên creator thành công',
      workspace: newWorkspace,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Lỗi khi tạo workspace:', error);
    res.status(500).json({
      message: 'Tạo workspace thất bại, đã rollback',
      error: error.message,
    });
  }
};

// Cập nhật workspace
exports.updateWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const updates = req.body;

    const workspace = await Workspace.findByIdAndUpdate(workspaceId, updates, {
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

// Đóng workspace
exports.closeWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
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

// Xóa workspace
exports.deleteWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findByIdAndDelete(workspaceId);
    if (!workspace) {
      return res
        .status(404)
        .json({ message: 'Workspace không tồn tại hoặc đã bị xóa' });
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

// mời người dùng tham gia workspace
exports.inviteMember = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { email, role = 'memberWorkspace' } = req.body;
    const inviterId = req.user._id;

    // 1. Kiểm tra workspace tồn tại
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace không tồn tại' });
    }

    // 2. Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    // 3. Kiểm tra nếu đã là thành viên
    const existing = await Membership.findOne({
      workspaceId,
      userId: user._id,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: 'Người dùng đã là thành viên hoặc đang chờ' });
    }

    // 4. Tạo token mời
    const token = crypto.randomBytes(32).toString('hex');

    // 5. Tạo bản ghi membership
    const membership = await Membership.create({
      workspaceId,
      userId: user._id,
      role,
      invitationStatus: 'pending',
      invitationToken: token,
    });

    // 6. Tạo link mời
    const inviteLink = `${process.env.FRONTEND_URL}/invite-response?token=${token}`;

    // 7. Gửi email thực tế
    await sendEmail(
      user.email,
      `Bạn được mời vào workspace "${workspace.name}"`,
      `
        <p>Xin chào ${user.username},</p>
        <p>Bạn được mời tham gia workspace <strong>${workspace.name}</strong>.</p>
        <p>Vui lòng nhấn vào liên kết sau để xác nhận lời mời:</p>
        <p><a href="${inviteLink}">Xác nhận lời mời</a></p>
        <p>Nếu không quan tâm, bạn có thể bỏ qua email này.</p>
      `
    );

    // 8. Phản hồi
    res.status(200).json({
      message: 'Đã gửi lời mời thành công',
      inviteLink,
    });
  } catch (err) {
    console.error('Lỗi gửi lời mời:', err);
    res.status(500).json({
      message: 'Lỗi khi gửi lời mời',
      error: err.message,
    });
  }
};

// Xác nhận lời mời
exports.respondToInvite = async (req, res) => {
  try {
    const { token, action } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Thiếu token xác nhận' });
    }

    const membership = await Membership.findOne({ invitationToken: token });
    if (!membership) {
      return res
        .status(400)
        .json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    if (membership.invitationStatus !== 'pending') {
      return res
        .status(400)
        .json({ message: 'Lời mời đã được xử lý trước đó' });
    }

    let workspace;

    if (action === 'accept') {
      membership.invitationStatus = 'accepted';

      // Cập nhật workspace.members
      workspace = await Workspace.findById(membership.workspaceId);
      if (workspace) {
        workspace.members.push(membership._id);
        await workspace.save();
      }
    } else if (action === 'decline') {
      membership.invitationStatus = 'declined';
    } else {
      return res.status(400).json({ message: 'Hành động không hợp lệ' });
    }

    membership.invitationToken = undefined;
    await membership.save();

    res.status(200).json({
      message: `Bạn đã ${
        action === 'accept' ? 'chấp nhận' : 'từ chối'
      } lời mời tham gia workspace.`,
      status: membership.invitationStatus,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Lỗi server khi phản hồi lời mời',
      error: err.message,
    });
  }
};
