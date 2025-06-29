const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Workspace = require('../models/workspaceModel');
const Board = require('../models/boardModel');
const BoardMembership = require('../models/boardMembershipModel');
exports.protect = async (req, res, next) => {
  try {
    // Token được gửi trong header Authorization theo định dạng: "Bearer <token>"
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Giải mã và lấy thông tin liên quan tới người dùng trong token
    const id = decoded?._id || decoded?.id;
    req.user = await User.findById(id).select('_id role email username createdAt'); // Tìm user với role cụ thể để gán vào req.user, phục vụ cho việc phân quyền
    next();
  } catch (error) {
    res.status(401).json({ status: 'error', message: error.message });
  }
};

// creator của workspace
exports.isCreator = async (req, res, next) => {
  const workspaceId = req.params.workspaceId;
  const userId = req.user._id;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res
      .status(404)
      .json({ success: false, mes: 'Workspace không tồn tại' });
  }

  if (workspace.creator.toString() !== req.user._id.toString()) {
    return res
      .status(401)
      .json({ success: false, mes: 'yêu cầu quyền của Creator' });
  }

  req.workspace = workspace;
  next();
};

// admin của workspace (<creator)
exports.isAdminWorkspace = async (req, res, next) => {
  try {
    // Lấy workspaceId từ route parameter
    const workspaceId = req.params.workspaceId;
    const userId = req.user._id;
    console.log('workspaceId', workspaceId);

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        mes: 'Thiếu workspaceId trong route',
      });
    }

    // Tìm workspace và populate members
    const workspace = await Workspace.findById(workspaceId).populate({
      path: 'members',
      model: 'Membership',
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        mes: 'Workspace không tồn tại',
      });
    }

    // Kiểm tra creator
    const isCreator = workspace.creator.toString() === userId.toString();

    // Kiểm tra xem user có là adminWorkspace không
    const isAdmin = workspace.members.some(
      (m) =>
        m.userId.toString() === userId.toString() &&
        m.role === 'adminWorkspace' &&
        !m.isDeleted &&
        m.invitationStatus === 'accepted'
    );

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        mes: 'Yêu cầu quyền adminWorkspace hoặc creatorWorkspace',
      });
    }

    // Lưu workspace vào req để controller dùng tiếp nếu cần
    req.workspace = workspace;
    next();
  } catch (err) {
    console.error('Lỗi isAdminWorkspace:', err);
    res.status(500).json({
      success: false,
      mes: 'Lỗi server',
      error: err.message,
    });
  }
};

// creator của board/project
exports.isCreatorBoard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const boardId = req.params.boardId; // hoặc req.body.boardId tuỳ route

    const board = await Board.findById(boardId);
    if (!board) {
      return res
        .status(404)
        .json({ success: false, message: 'Board không tồn tại' });
    }

    if (board.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Creator mới có thể thực hiện hành động này',
      });
    }

    // gán board vào req nếu cần dùng tiếp
    req.board = board;
    next();
  } catch (err) {
    console.error('Lỗi kiểm tra isCreatorBoard:', err);
    res
      .status(500)
      .json({ success: false, message: 'Lỗi server', error: err.message });
  }
};

// admin của board/project (<creator)
exports.isAdminBoard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const boardId = req.params.boardId; // hoặc req.body.boardId tuỳ route
    console.log('boardId', boardId);

    const board = await Board.findById(boardId);
    if (!board) {
      return res
        .status(404)
        .json({ success: false, message: 'Board không tồn tại' });
    }

    // Nếu là creator thì cũng được
    if (board.creator.toString() === userId.toString()) {
      req.board = board;
      return next();
    }

    // Kiểm tra xem có membership role = 'admin' và đã accepted
    const isAdmin = await BoardMembership.exists({
      boardId,
      userId,
      role: 'admin',
      applicationStatus: 'accepted',
      isDeleted: false,
    });

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin hoặc Creator mới có thể thực hiện hành động này',
      });
    }

    req.board = board;
    next();
  } catch (err) {
    console.error('Lỗi kiểm tra isAdminBoard:', err);
    res
      .status(500)
      .json({ success: false, message: 'Lỗi server', error: err.message });
  }
};