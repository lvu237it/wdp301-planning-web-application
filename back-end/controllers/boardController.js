const mongoose = require('mongoose');
const crypto = require('crypto');
const Board = require('../models/boardModel');
const BoardMembership = require('../models/boardMembershipModel');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendMail');
const WorkspaceMembership = require('../models/memberShipModel');
const Workspace = require('../models/workspaceModel');
const List = require('../models/listModel');

// get all boards theo workspaceId, boardId, visibility, isDeleted
exports.getBoardsByWorkspace = async (req, res) => {
  try {
    const userId = req.user._id;
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
    const userBoardDocs = await BoardMembership.find({
      userId,
      workspaceId: wsId,
      applicationStatus: 'accepted',
      isDeleted: false,
    }).select('boardId');
    const boardIds = userBoardDocs.map((doc) => doc.boardId);

    // 3. Query board trong workspace đó
    const boards = await Board.find({
      workspaceId: wsId,
      isDeleted: false,
      $or: [{ visibility: 'public' }, { _id: { $in: boardIds } }],
    })
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

// Lấy thông tin chi tiết của một board
exports.getBoardById = async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user._id;

    console.log('boardId to get detail', boardId);

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

// cập nhật Board
exports.updateBoard = async (req, res) => {
  try {
    const { boardId } = req.params; // nếu route là /workspace/:workspaceId/board/:boardId
    const updates = req.body;
    console.log('boardId', boardId);

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

// thêm người dùng với read-only role trên Board
exports.inviteBoardMember = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { email, role = 'read-only' } = req.body;
    const inviterId = req.user._id;

    // 5.1 Kiểm tra Board tồn tại
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board không tồn tại' });
    }

    // 5.2 Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    // 5.3 Kiểm tra xem đã có membership chưa
    const existing = await BoardMembership.findOne({
      boardId,
      userId: user._id,
      isDeleted: false,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: 'Người dùng đã là member hoặc đang chờ xét' });
    }

    // 5.4 Tạo token mời
    const token = crypto.randomBytes(32).toString('hex');

    // 5.5 Tạo BoardMembership với invitationResponse = 'pending'
    const membership = await BoardMembership.create({
      boardId,
      userId: user._id,
      role, // read-only hoặc admin (thường vẫn để read-only)
      applicationStatus: 'applied', // lúc invite, coi như đã applied để chờ xét
      invitationResponse: 'pending',
      invitedBy: inviterId,
      invitedAt: new Date(),
      invitationToken: token,
    });

    // 5.6 Gửi email
    const inviteLink = `${process.env.FRONTEND_URL}/board-invite-response?token=${token}`;
    await sendEmail(
      user.email,
      `Bạn được mời vào Board "${board.name}"`,
      `
        <p>Xin chào ${user.username},</p>
        <p>Bạn được mời tham gia Board <strong>${board.name}</strong>.</p>
        <p>Nhấn vào link sau để chấp nhận hoặc từ chối:</p>
        <p><a href="${inviteLink}">${inviteLink}</a></p>
        <p>Nếu không quan tâm, có thể bỏ qua email này.</p>
      `
    );

    res.status(200).json({
      message: 'Đã gửi lời mời thành công',
      inviteLink,
    });
  } catch (err) {
    console.error('Lỗi khi mời Board member:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// phản hồi lời mời Board
exports.respondToBoardInvite = async (req, res) => {
  try {
    const { token, action } = req.body; // action: 'accept' | 'decline'

    if (!token || !['accept', 'decline'].includes(action)) {
      return res
        .status(400)
        .json({ message: 'Thiếu token hoặc action không hợp lệ' });
    }

    // 1. Tìm membership theo token
    const membership = await BoardMembership.findOne({
      invitationToken: token,
    });
    if (!membership) {
      return res
        .status(400)
        .json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // 2. Kiểm tra đã xử lý rồi?
    if (membership.invitationResponse !== 'pending') {
      return res
        .status(400)
        .json({ message: 'Lời mời đã được xử lý trước đó' });
    }

    // 3. Xử lý action
    //    Chúng ta gán invitationResponse (thay vì applicationStatus)
    if (action === 'accept') {
      membership.invitationResponse = 'accepted';
    } else {
      membership.invitationResponse = 'declined';
    }

    // Lưu lại trước khi save, để trả về cho client
    const responseStatus = membership.invitationResponse; // 'accepted' hoặc 'declined'

    // 4. Xóa token để không dùng lại
    membership.invitationToken = undefined;

    // 5. Lưu object; middleware pre('save') sẽ tự bật logic:
    //    - Nếu accepted → gán applicationStatus='accepted', role='member', invitationResponse=null, appliedAt
    //    - Nếu declined → gán isDeleted=true, deletedAt
    await membership.save();

    // 6. Trả về cho client
    return res.status(200).json({
      message: `Bạn đã ${
        action === 'accept' ? 'chấp nhận' : 'từ chối'
      } lời mời vào Board.`,
      status: responseStatus, // trả 'accepted' hoặc 'declined'
    });
  } catch (err) {
    console.error('Lỗi khi xử lý invite-response:', err);
    return res.status(500).json({
      message: 'Lỗi server khi phản hồi lời mời',
      error: err.message,
    });
  }
};
