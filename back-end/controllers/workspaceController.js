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
    console.log('🔥 DELETE /workspace/:id hit with', req.params.workspaceId);
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
    const emailHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Invite to Workspace</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <!-- Container chính -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; font-family:Arial, sans-serif; color:#333333;">
                   <!-- Header với title PlanPro -->
          <tr>
            <td align="center" style="padding:30px 0; background-color:#004080;">
              <span style="
                font-size:32px;
                font-weight:bold;
                color:#ffffff;
                font-family:Arial, sans-serif;
                text-transform:uppercase;
                letter-spacing:2px;
              ">
               PlanPro
              </span>
            </td>
          </tr>

          <!-- Body nội dung -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin-top:0; color:#004080; font-size:24px;">Xin chào ${
                user.username
              },</h2>
              <p style="font-size:16px; line-height:1.5;">
                Bạn đã được mời tham gia <strong>workspace "${
                  workspace.name
                }"</strong> trên hệ thống của chúng tôi.
              </p>
              <p style="font-size:16px; line-height:1.5;">
                Nhấn vào nút bên dưới để xác nhận và tham gia:
              </p>

              <!-- Nút CTA -->
              <p style="text-align:center; margin:30px 0;">
                <a
                  href="${inviteLink}"
                  style="
                    display:inline-block;
                    background-color:#007bff;
                    color:#ffffff !important;
                    text-decoration:none;
                    padding:12px 24px;
                    border-radius:4px;
                    font-size:16px;
                    font-weight:bold;
                  "
                >
                  XÁC NHẬN LỜI MỜI
                </a>
              </p>

              <p style="font-size:14px; color:#666666; line-height:1.5;">
                Nếu bạn không quan tâm đến lời mời này, bạn có thể bỏ qua email.  
                Lời mời sẽ tự động hết hiệu lực sau 7 ngày.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px; background-color:#f0f0f0; font-size:12px; color:#888888; text-align:center;">
              <p style="margin:0;">
                © ${new Date().getFullYear()} WebPlanPro. Đã đăng ký bản quyền.
              </p>
              <p style="margin:5px 0 0;">
                Địa chỉ: WebPlanPro, Thạch Thất, Hà Nội, Việt Nam
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
    // 7. Gửi email thực tế
    await sendEmail(
      user.email,
      `Bạn được mời vào workspace "${workspace.name}"`,
      emailHtml
    );
    // 7.1 gửi thông báo real-time sau khi gửi lời mời
    await NotificationService.createPersonalNotification({
      title: `Lời mời tham gia workspace`,
      content: `Bạn được mời tham gia workspace "${workspace.name}"`,
      type: 'workspace_invite',
      targetUserId: user._id,
      targetWorkspaceId: workspace._id,
      createdBy: inviterId,
    });

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
