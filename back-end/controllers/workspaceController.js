const mongoose = require('mongoose');
const Workspace = require('../models/workspaceModel');
const Membership = require('../models/memberShipModel');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendMail');
const Board = require('../models/boardModel');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const NotificationService = require('../services/NotificationService');

// Lấy workspace mà user đã tạo hoặc đã tham gia, kèm countBoard
exports.getAllWorkspace = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Tìm tất cả membership đã accepted của người dùng
    const memberships = await Membership.find({
      userId,
      invitationStatus: 'accepted',
      isDeleted: false,
    }).select('workspaceId');

    const workspaceIdsFromMembership = memberships.map((m) => m.workspaceId);

    // 2. Lấy workspaces (creator hoặc thành viên)
    //    .lean() để được plain JS object, dễ gắn thêm field
    const workspaces = await Workspace.find({
      isDeleted: false,
      $or: [{ creator: userId }, { _id: { $in: workspaceIdsFromMembership } }],
    })
      .populate('creator', 'username email')
      .populate({
        path: 'members',
        match: { isDeleted: false },
        populate: {
          path: 'userId',
          select: 'username email',
        },
      })
      .lean();

    // 3. Với mỗi workspace, đếm số boards
    const workspacesWithCount = await Promise.all(
      workspaces.map(async (ws) => {
        const count = await Board.countDocuments({
          workspaceId: ws._id,
          isDeleted: false,
        });
        return {
          ...ws,
          countBoard: count, // ← gắn thêm trường countBoard
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: workspacesWithCount,
    });
  } catch (error) {
    console.error('getAllWorkspace error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
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
      message: 'Create workspace and membership successfully',
      workspace: newWorkspace,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Lỗi khi tạo workspace:', error);
    res.status(500).json({
      message: 'Create workspace failed',
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
      return res.status(404).json({ message: 'Workspace not found' });
    }

    res.status(200).json({
      message: 'Update workspace successfully',
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating workspace',
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
      return res.status(404).json({ message: 'Workspace is not found' });
    }

    if (workspace.isDeleted) {
      return res.status(400).json({ message: 'Workspace is already closed' });
    }

    workspace.isDeleted = true;
    workspace.deletedAt = new Date();
    await workspace.save();

    res.status(200).json({
      message: 'Workspace is closed successfully',
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error closing workspace',
      error: error.message,
    });
  }
};

// Xóa workspace
exports.deleteWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    console.log('🔥 DELETE /workspace/:id hit with', req.params.workspaceId);
    const workspace = await Workspace.findByIdAndDelete(workspaceId);
    if (!workspace) {
      return res
        .status(404)
        .json({ message: 'Workspace not found or already deleted' });
    }

    res.status(200).json({
      message: 'Workspace deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting workspace',
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
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // 2. Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 3. Kiểm tra nếu đã là thành viên
    const existing = await Membership.findOne({
      workspaceId,
      userId: user._id,
    });
    if (existing) {
      return res
        .status(400)
        .json({
          message: 'User is already a member of the workspace or invited',
        });
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

    // 6. Không gửi email nữa, chỉ tạo notification
    // 7. Gửi thông báo real-time sau khi gửi lời mời, truyền token vào content/data
    await NotificationService.createPersonalNotification({
      title: `You have an invitation`,
      content: `You have been invited to join workspace "${workspace.name}"`,
      type: 'workspace_invite',
      targetUserId: user._id,
      targetWorkspaceId: workspace._id,
      createdBy: inviterId,
      // Truyền thêm invitationToken vào data (nếu NotificationService hỗ trợ)
      invitationToken: token,
    });

    // 8. Phản hồi
    res.status(200).json({
      message: 'Successfully invited user to workspace',
      // inviteLink,
      invitationToken: token,
    });
  } catch (err) {
    console.error('Error inviting user to workspace', err);
    res.status(500).json({
      message: 'Error inviting user to workspace',
      error: err.message,
    });
  }
};

// Xác nhận lời mời
exports.respondToInvite = async (req, res) => {
  try {
    const { token, action } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ message: 'Missing token', status: 'invalid' });
    }

    // Tìm membership theo token
    const membership = await Membership.findOne({ invitationToken: token });
    if (!membership) {
      return res.status(400).json({
        message: 'Invitation is invalid or expired.',
        status: 'invalid',
      });
    }

    // Kiểm tra user có khớp với token không
    if (
      req.user._id.toString() !== membership.userId.toString() ||
      req.user.id.toString() !== membership.userId.toString()
    ) {
      return res.status(403).json({
        message: 'You do not have permission to respond to this invitation.',
        status: 'forbidden',
      });
    }

    // Kiểm tra trạng thái lời mời
    if (membership.invitationStatus === 'accepted') {
      return res.status(409).json({
        message: 'Invitation has already been accepted.',
        status: 'accepted',
      });
    }
    if (membership.invitationStatus !== 'pending') {
      return res.status(409).json({
        message: 'Invitation has already been responded.',
        status: membership.invitationStatus,
      });
    }

    let workspace;
    if (action === 'accept') {
      membership.invitationStatus = 'accepted';
      // Cập nhật workspace.members
      workspace = await Workspace.findById(membership.workspaceId);
      if (workspace) {
        // Tránh thêm trùng membership
        if (!workspace.members.includes(membership._id)) {
          workspace.members.push(membership._id);
          await workspace.save();
        }
      }
    } else if (action === 'decline') {
      membership.invitationStatus = 'declined';
    } else {
      return res
        .status(400)
        .json({ message: 'Invalid action', status: 'invalid_action' });
    }

    membership.invitationToken = undefined;
    await membership.save();

    return res.status(200).json({
      message: `You have ${
        action === 'accept' ? 'accepted' : 'declined'
      } the invitation to join workspace.`,
      status: membership.invitationStatus,
    });
  } catch (err) {
    // Chỉ trả về lỗi 500 cho lỗi thực sự bất ngờ
    console.error('Error responding to invite:', err);
    res.status(500).json({
      message: 'Error responding to invite',
      error: err.message,
      status: 'error',
    });
  }
};

/**
 * GET /workspace/:workspaceId/users
 * Return all non‐deleted, accepted members of a workspace,
 * with basic user info and their workspace‐role.
 */
exports.getWorkspaceUsers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findById(workspaceId)
      .populate({
        path: 'members',
        match: { isDeleted: false, invitationStatus: 'accepted' },
        populate: { path: 'userId', select: 'username email fullname avatar' },
      })
      .lean();
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const users = workspace.members.map((m) => ({
      _id: m.userId._id,
      username: m.userId.username,
      email: m.userId.email,
      fullname: m.userId.fullname,
      avatar: m.userId.avatar,
      role: m.role,
      joinDate: m.createdAt,
    }));

    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error('getWorkspaceUsers error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
