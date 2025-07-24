const mongoose = require('mongoose');
const crypto = require('crypto');
const Board = require('../models/boardModel');
const BoardMembership = require('../models/boardMembershipModel');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendMail');
const WorkspaceMembership = require('../models/memberShipModel');
const Workspace = require('../models/workspaceModel');
const List = require('../models/listModel');
const NotificationService = require('../services/NotificationService');
const Task = require('../models/taskModel');
const Notification = require('../models/notificationModel');
const NotificationUser = require('../models/notificationUserModel');
// get all boards theo workspaceId, boardId, visibility, isDeleted
exports.getBoardsByWorkspace = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const wsId = req.params.workspaceId;

    // 0. Kiểm tra workspace tồn tại và chưa xóa
    const workspace = await Workspace.findOne({ _id: wsId, isDeleted: false });
    if (!workspace) {
      return res
        .status(404)
        .json({ success: false, message: 'Workspace not found' });
    }

    // 1. Kiểm tra user có phải creator hoặc đã join workspace này không
    const isCreator = workspace.creator.equals(userId);
    const isMember = await WorkspaceMembership.exists({
      userId,
      workspaceId: wsId,
      invitationStatus: 'accepted',
      isDeleted: false,
    });
    if (!isCreator && !isMember) {
      return res
        .status(403)
        .json({ success: false, message: 'Access denied to this workspace' });
    }

    // 2. Lấy list boardId mà user đã join trong workspace này
    const boardDocsInWorkspace = await Board.find({
      workspaceId: wsId,
      isDeleted: false,
    }).select('_id');

    const boardIdsInWorkspace = boardDocsInWorkspace.map((b) => b._id);

    const userBoardDocs = await BoardMembership.find({
      userId,
      boardId: { $in: boardIdsInWorkspace },
      applicationStatus: 'accepted',
      isDeleted: false,
    }).select('boardId');

    const boardIds = userBoardDocs.map((doc) => doc.boardId);

    // 3. Query board trong workspace đó
    // Nếu là creator thì list tất cả (không cần $or)
    const filter = { workspaceId: wsId, isDeleted: false };
    if (!isCreator) {
      filter.$or = [{ visibility: 'public' }, { _id: { $in: boardIds } }];
    }
    const boards = await Board.find(filter)
      .populate('creator', 'username email')
      .populate('workspaceId', 'name')
      .lean();

    // 4. Lấy tất cả membership của các board này để nối vào members[]
    const boardMemberships = await BoardMembership.find({
      boardId: { $in: boards.map((b) => b._id) },
      isDeleted: false,
    })
      .populate('userId', 'username email avatar')
      .lean();

    const membersByBoard = boardMemberships.reduce((acc, m) => {
      const bId = m.boardId.toString();
      acc[bId] = acc[bId] || [];
      acc[bId].push({
        _id: m.userId._id,
        username: m.userId.username,
        email: m.userId.email,
        avatar: m.userId.avatar || null,
        role: m.role,
        status: m.applicationStatus,
      });
      return acc;
    }, {});

    // 5. Trả về
    const result = boards.map((b) => ({
      ...b,
      members: membersByBoard[b._id.toString()] || [],
    }));

    return res.status(200).json({ success: true, boards: result });
  } catch (err) {
    console.error('getBoardsByWorkspace error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error when fetching boards',
      error: err.message,
    });
  }
};

// tạo Board
exports.createBoard = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      description,
      visibility, // 'public' hoặc 'private'
      criteria, // object { skills: [...], yearOfExperience: {min,max}, workDuration: {min,max,unit} }
    } = req.body;
    const workspaceId = req.params.workspaceId; // nếu route là /workspace/:workspaceId/board/create
    const creatorId = req.user._id;

    // 1. Kiểm tra trường bắt buộc
    if (!name || !workspaceId || !visibility || !criteria) {
      throw new Error(
        'Thiếu thông tin bắt buộc: name, workspaceId, visibility hoặc criteria'
      );
    }

    // 2. Tạo Board
    //     - visibility đã được validate theo enum ['public','private']
    //     - criteria phải chứa đầy đủ các trường required theo schema
    const [newBoard] = await Board.create(
      [
        {
          name,
          description,
          creator: creatorId,
          workspaceId,
          visibility,
          criteria,
        },
      ],
      { session }
    );

    // 3. Tạo BoardMembership cho creator với role 'admin'
    const [membership] = await BoardMembership.create(
      [
        {
          boardId: newBoard._id,
          userId: creatorId,
          role: 'admin',
          applicationStatus: 'accepted',
          invitationResponse: null,
          invitedBy: null,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Tạo board thành công',
      board: newBoard,
      membershipId: membership._id,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Lỗi tạo Board:', err);
    res.status(500).json({
      message: 'Tạo Board thất bại, đã rollback',
      error: err.message,
    });
  }
};

// Lấy thông tin chi tiết của một board
exports.getBoardById = async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user._id || req.user.id;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        success: false,
        message: 'boardId không hợp lệ',
      });
    }

    // Tìm board
    const board = await Board.findOne({ _id: boardId, isDeleted: false })
      .populate('creator', 'username email')
      .populate('workspaceId', 'name')
      .lean();

    console.log('boardfound', board);

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board không tồn tại',
      });
    }

    // Kiểm tra quyền truy cập
    const isCreator = board.creator._id.equals(userId);
    const isMember = await BoardMembership.exists({
      userId,
      boardId,
      applicationStatus: 'accepted',
      isDeleted: false,
    });

    if (!isCreator && !isMember && board.visibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập board này',
      });
    }

    // Lấy thông tin members
    const boardMemberships = await BoardMembership.find({
      boardId,
      isDeleted: false,
    })
      .populate('userId', 'username email avatar')
      .lean();

    console.log('boardMemberships', boardMemberships);

    const members = boardMemberships.map((m) => ({
      _id: m.userId._id,
      username: m.userId.username,
      email: m.userId.email,
      avatar: m.userId.avatar || null,
      role: m.role,
      status: m.applicationStatus,
    }));

    const result = {
      ...board,
      members,
    };

    console.log('resules', result);

    return res.status(200).json({
      success: true,
      board: result,
    });
  } catch (err) {
    console.error('getBoardById error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error when fetching board',
      error: err.message,
    });
  }
};

// cập nhật Board
exports.updateBoard = async (req, res) => {
  try {
    const { boardId } = req.params; // nếu route là /workspace/:workspaceId/board/:boardId
    const updates = req.body;
    const board = await Board.findByIdAndUpdate(boardId, updates, {
      new: true,
      runValidators: true,
    });

    if (!board) {
      return res.status(404).json({ message: 'Board không tồn tại' });
    }

    return res.status(200).json({
      message: 'Cập nhật Board thành công',
      board,
    });
  } catch (err) {
    console.error('Lỗi server khi cập nhật Board:', err);
    return res.status(500).json({
      message: 'Lỗi server khi cập nhật Board',
      error: err.message,
    });
  }
};

// đóng Board
exports.closeBoard = async (req, res) => {
  try {
    const { boardId } = req.params;

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board không tồn tại' });
    }

    if (board.isDeleted) {
      return res.status(400).json({ message: 'Board đã bị đóng trước đó' });
    }

    board.isDeleted = true;
    board.deletedAt = new Date();
    await board.save();

    res.status(200).json({
      message: 'Đã đóng (soft delete) Board',
      board,
    });
  } catch (err) {
    console.error('Lỗi server khi đóng Board:', err);
    res.status(500).json({
      message: 'Lỗi server khi đóng Board',
      error: err.message,
    });
  }
};

// xóa Board
exports.deleteBoard = async (req, res) => {
  try {
    const { boardId } = req.params;

    const board = await Board.findByIdAndDelete(boardId);
    if (!board) {
      return res
        .status(404)
        .json({ message: 'Board không tồn tại hoặc đã bị xóa' });
    }

    // Mark tất cả BoardMembership liên quan thành deleted (optional)
    await BoardMembership.updateMany(
      { boardId: boardId },
      { isDeleted: true, deletedAt: new Date() }
    );

    res.status(200).json({
      message: 'Đã xóa vĩnh viễn Board',
    });
  } catch (err) {
    console.error('Lỗi server khi xóa Board:', err);
    res.status(500).json({
      message: 'Lỗi server khi xóa Board',
      error: err.message,
    });
  }
};

exports.inviteBoardMembers = async (req, res) => {
  try {
    const { workspaceId, boardId } = req.params;
    const { emails, role = 'read-only' } = req.body;
    const inviterId = req.user._id;

    // 1) Lấy board đích
    const boardFound = await Board.find({ _id: boardId, isDeleted: false });
    const board = boardFound[0];
    console.log('board found', board);
    if (!board) {
      return res
        .status(404)
        .json({ message: 'Board không tồn tại hoặc đã bị xoá' });
    }

    // Check criteria tồn tại
    if (!board.criteria || !board.criteria.workDuration) {
      return res.status(400).json({
        message: 'Board thiếu thông tin criteria hoặc workDuration',
      });
    }

    const { workDuration: wdTarget } = board.criteria;

    // Check workDuration có startDate và endDate hợp lệ
    if (!wdTarget.startDate || !wdTarget.endDate) {
      return res.status(400).json({
        message: 'Board workDuration thiếu startDate hoặc endDate',
      });
    }

    // 2) Lấy users theo emails
    const users = await User.find({ email: { $in: emails } });
    if (!users.length) {
      return res
        .status(400)
        .json({ message: 'Không tìm thấy user nào với emails đã cho' });
    }

    // 3) Check xem có invite hoặc member rồi
    // Tìm tất cả membership liên quan đến board và user
    const userIds = users.map((u) => u._id);
    const existingMemberships = await BoardMembership.find({
      boardId,
      userId: { $in: userIds },
    });

    // Tách userIds thành các nhóm: đã là member, đang chờ xác nhận, đã declined, chưa có
    const alreadyMemberIds = new Set();
    const pendingIds = new Set();
    const declinedIds = new Set();
    const toInviteIds = new Set(userIds.map((id) => id.toString()));
    const membershipMap = {};
    for (const mem of existingMemberships) {
      membershipMap[mem.userId.toString()] = mem;
      if (!mem.isDeleted && mem.invitationResponse === 'accepted') {
        alreadyMemberIds.add(mem.userId.toString());
        toInviteIds.delete(mem.userId.toString());
      } else if (!mem.isDeleted && mem.invitationResponse === 'pending') {
        pendingIds.add(mem.userId.toString());
        toInviteIds.delete(mem.userId.toString());
      } else if (mem.invitationResponse === 'declined' || mem.isDeleted) {
        // Cho phép mời lại
        declinedIds.add(mem.userId.toString());
      }
    }

    // Nếu tất cả user đều đã là member hoặc đang chờ xác nhận, trả về lỗi
    if (toInviteIds.size === 0 && declinedIds.size === 0) {
      return res.status(400).json({
        message: 'Người dùng đã là thành viên hoặc đang chờ xác nhận',
      });
    }

    // 4) Lấy tất cả các board khác mà user đã accepted
    const acceptedMems = await BoardMembership.find({
      userId: { $in: userIds },
      invitationResponse: 'accepted',
      isDeleted: false,
      boardId: { $ne: boardId },
    }).populate('boardId', 'criteria.workDuration name');

    // 5) Kiểm tra overlap
    const overlap = acceptedMems.find((m) => {
      const otherBoard = m.boardId;
      if (
        !otherBoard ||
        !otherBoard.criteria ||
        !otherBoard.criteria.workDuration
      ) {
        return false; // skip nếu board kia thiếu dữ liệu
      }

      const wd = otherBoard.criteria.workDuration;
      if (!wd.startDate || !wd.endDate) {
        return false; // skip nếu board kia thiếu ngày
      }

      // So sánh overlap
      return (
        new Date(wdTarget.startDate) < new Date(wd.endDate) &&
        new Date(wd.startDate) < new Date(wdTarget.endDate)
      );
    });

    if (overlap) {
      const {
        name: otherName,
        criteria: { workDuration: wd },
      } = overlap.boardId;
      return res.status(400).json({
        message:
          `User ${
            users[0].fullname || users[0].username
          } đang tham gia "${otherName}" ` +
          `trong giai đoạn ${new Date(wd.startDate)
            .toISOString()
            .slice(0, 10)} → ` +
          `${new Date(wd.endDate)
            .toISOString()
            .slice(0, 10)}. Vui lòng mời người dùng khác.`,
      });
    }

    // 6) Nếu OK, tạo hoặc cập nhật invite
    const token = crypto.randomBytes(32).toString('hex');
    const invites = [];
    // Cập nhật lại các membership đã declined hoặc isDeleted
    for (const userId of declinedIds) {
      if (!toInviteIds.has(userId)) continue; // chỉ update nếu user nằm trong danh sách mời lại
      const mem = membershipMap[userId];
      mem.role = role;
      mem.applicationStatus = 'applied';
      mem.invitationResponse = 'pending';
      mem.invitedBy = inviterId;
      mem.invitedAt = new Date();
      mem.invitationToken = token;
      mem.isDeleted = false;
      mem.deletedAt = undefined;
      await mem.save();
      toInviteIds.delete(userId);
    }
    // Tạo mới cho các user chưa có membership
    for (const userId of toInviteIds) {
      invites.push({
        boardId,
        userId,
        role,
        applicationStatus: 'applied',
        invitationResponse: 'pending',
        invitedBy: inviterId,
        invitedAt: new Date(),
        invitationToken: token,
      });
    }
    if (invites.length > 0) {
      await BoardMembership.insertMany(invites);
    }

    // 7)Gửi thông báo cho từng user
    for (const user of users) {
      if (
        alreadyMemberIds.has(user._id.toString()) ||
        pendingIds.has(user._id.toString())
      )
        continue; // Không gửi lại cho member hoặc đang pending
      const inviteLink = `${process.env.FRONTEND_URL}/board-invite-response?token=${token}`;
      await NotificationService.createPersonalNotification({
        title: `Invitation to join board`,
        content: `You were invited to join board "${board.name}"`,
        type: 'board_invite',
        targetUserId: user._id,
        targetWorkspaceId: board.workspaceId,
        createdBy: inviterId,
        invitationToken: token,
        boardId: board._id, // thêm trường này
      });
    }

    return res.status(200).json({ message: 'Send invitation successfully' });
  } catch (err) {
    console.error('❌ inviteBoardMembers error:', err);
    return res
      .status(500)
      .json({ message: 'Server error', error: err.message });
  }
};

// phản hồi lời mời Board
exports.respondToBoardInvite = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { token, action } = req.body; // action: 'accept' | 'decline'
    const userId = req.user._id; // Lấy từ authMiddleware

    if (!token || !['accept', 'decline'].includes(action)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: 'Thiếu token hoặc action không hợp lệ' });
    }

    // 1. Tìm membership theo token
    const membership = await BoardMembership.findOne({
      invitationToken: token,
    }).session(session);

    if (!membership) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // 2. Kiểm tra đã xử lý rồi?
    if (membership.invitationResponse !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: 'Lời mời đã được xử lý trước đó' });
    }

    // 3. Xử lý action
    if (action === 'accept') {
      membership.invitationResponse = 'accepted';
      // accepted: applicationStatus and role will be set by pre-save middleware
      membership.invitationToken = undefined;
      await membership.save({ session });
    } else {
      // decline: mark as deleted and set deletedAt
      membership.invitationResponse = 'declined';
      membership.isDeleted = true;
      membership.deletedAt = new Date();
      membership.invitationToken = undefined;
      await membership.save({ session });
    }
    const responseStatus = membership.invitationResponse;

    // 4. Tìm và cập nhật NotificationUser để đánh dấu thông báo đã đọc
    const notification = await Notification.findOne({
      boardId: membership.boardId,
      type: 'board_invite',
      targetUserId: userId,
    }).session(session);

    if (notification) {
      await NotificationUser.findOneAndUpdate(
        { notificationId: notification._id, userId },
        { isRead: true, readAt: new Date() },
        { new: true, upsert: true, session }
      );
    }

    // 7. Commit transaction
    await session.commitTransaction();
    session.endSession();

    // 8. Trả về cho client
    return res.status(200).json({
      message: `You have ${
        action === 'accept' ? 'accepted' : 'declined'
      } the invitation to the Board.`,
      status: responseStatus,
      membership, // Trả về membership đã cập nhật
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Lỗi khi xử lý invite-response:', err);
    return res.status(500).json({
      message: 'Lỗi server khi phản hồi lời mời',
      error: err.message,
    });
  }
};

//get qualified users for board
exports.getQualifiedUsers = async (req, res) => {
  try {
    const { boardId } = req.params;

    // 1) Tìm board
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board không tồn tại' });
    }

    // 2) Lấy các user đã accepted trong workspace (loại bỏ creator)
    const workspaceMems = await WorkspaceMembership.find({
      workspaceId: board.workspaceId,
      invitationStatus: 'accepted',
      isDeleted: false,
      role: { $ne: 'creatorWorkspace' },
    }).select('userId');
    const workspaceUserIds = workspaceMems.map((m) => m.userId);

    if (!workspaceUserIds.length) {
      return res
        .status(200)
        .json({ users: [], message: 'Chưa có thành viên nào trong workspace' });
    }

    // 3) Lấy các user đã là member của board này
    const boardMems = await BoardMembership.find({
      boardId: board._id,
      invitationResponse: 'accepted', // hoặc invitationStatus tuỳ model
      isDeleted: false,
    }).select('userId');
    const boardUserIds = boardMems.map((m) => m.userId);

    // 4) Chỉ giữ những user vừa ở workspace, vừa chưa ở board
    const candidateIds = workspaceUserIds.filter(
      (uId) => !boardUserIds.some((bId) => bId.equals(uId))
    );
    if (!candidateIds.length) {
      return res
        .status(200)
        .json({ users: [], message: 'Không có user nào đủ điều kiện' });
    }

    // 5) Build query động dựa trên criteria
    const { skills, yearOfExperience, workDuration } = board.criteria || {};
    const userQuery = { _id: { $in: candidateIds } };

    if (Array.isArray(skills) && skills.length) {
      userQuery.skills = { $in: skills };
    }
    if (yearOfExperience?.min != null) {
      userQuery.yearOfExperience = { $gte: yearOfExperience.min };
    }
    if (workDuration?.startDate && workDuration?.endDate) {
      const span =
        workDuration.endDate.getTime() - workDuration.startDate.getTime();
      userQuery.$expr = {
        $gte: [
          {
            $subtract: [
              '$expectedWorkDuration.endDate',
              '$expectedWorkDuration.startDate',
            ],
          },
          span,
        ],
      };
    }

    // 6) Trả về danh sách user
    const users = await User.find(userQuery).select(
      'username email skills yearOfExperience expectedWorkDuration'
    );

    return res.status(200).json({ users });
  } catch (err) {
    console.error('Lỗi getQualifiedUsers:', err);
    return res.status(500).json({
      message: 'Server lỗi khi lấy người dùng theo tiêu chí',
      error: err.message,
    });
  }
};

// suggest members by skill and date
exports.suggestMembers = async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    const { boardId } = req.params;
    let { skills, startDate, endDate } = req.query;
    console.log('skill', skills);
    console.log('startDate', startDate);
    console.log('endDate', endDate);

    if (!startDate || !endDate) {
      return res.status(400).json({
        message:
          'Cần truyền đủ cả startDate và endDate nếu muốn lọc theo thời gian',
      });
    }

    // Đảm bảo startDate và endDate có định dạng đầy đủ ISO (có giờ)
    const reqStart = new Date(startDate);
    const reqEnd = new Date(endDate);

    // B1. Lấy thành viên đã accepted
    const boardMems = await BoardMembership.find({
      boardId,
      invitationResponse: 'accepted',
      isDeleted: false,
    }).select('userId');

    const boardUserIds = boardMems.map((m) => m.userId.toString());
    if (!boardUserIds.length) {
      return res
        .status(200)
        .json({ users: [], message: 'Board chưa có thành viên nào' });
    }

    // B2. Lấy task có khoảng thời gian giao nhau (overlap) với reqStart - reqEnd
    const overlappingTasks = await Task.find({
      boardId,
      assignedTo: { $in: boardUserIds },
      isDeleted: false,
      startDate: { $lt: reqEnd },
      endDate: { $gt: reqStart },
    }).select('assignedTo startDate endDate');
    overlappingTasks.forEach((t, i) => {
      console.log(`  🔸 Task ${i + 1}:`, {
        assignedTo: t.assignedTo?.toString(),
        from: t.startDate?.toISOString(),
        to: t.endDate?.toISOString(),
      });
    });

    const busyUserIds = new Set(
      overlappingTasks
        .map((t) => t.assignedTo)
        .filter((id) => id)
        .map((id) => id.toString())
    );

    // B3. Lọc thành viên chưa bận
    const availableUserIds = boardUserIds.filter(
      (uid) => !busyUserIds.has(uid)
    );

    if (!availableUserIds.length) {
      return res
        .status(200)
        .json({ users: [], message: 'Không có ai rảnh trong thời gian này' });
    }

    // B4. Truy vấn user phù hợp
    const userQuery = {
      _id: {
        $in: availableUserIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
      'expectedWorkDuration.startDate': { $lte: reqStart },
      'expectedWorkDuration.endDate': { $gte: reqEnd },
    };

    // B5. Thêm điều kiện kỹ năng nếu có
    if (skills && typeof skills === 'string') {
      const skillArr = skills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      if (skillArr.length > 0) {
        userQuery.skills = { $in: skillArr };
      }
    }

    const users = await User.find(userQuery).select(
      'username email avatar skills expectedWorkDuration'
    );

    console.log('Số người dùng được gợi ý:', users.length);
    return res.status(200).json({ users });
  } catch (err) {
    console.error('Lỗi suggestMembers:', err);
    return res.status(500).json({
      message: 'Server lỗi khi lọc thành viên',
      error: err.message,
    });
  }
};
