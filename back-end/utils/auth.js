const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Workspace = require('../models/workspaceModel');

exports.protect = async (req, res, next) => {
  try {
    // Token được gửi trong header Authorization theo định dạng: "Bearer <token>"
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Giải mã và lấy thông tin liên quan tới người dùng trong token
    req.user = await User.findById(decoded._id).select(
      'role email createdAt description'
    ); // Tìm user với role cụ thể để gán vào req.user, phục vụ cho việc phân quyền
    console.log('req.user', req.user);
    next();
  } catch (error) {
    res.status(401).json({ status: 'error', message: error.message });
  }
};

// creator của workspace
exports.isCreator = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const workspace = await Workspace.findById(id);
  if (!workspace) {
    return res
      .status(404)
      .json({ success: false, mes: 'Workspace không tồn tại' });
  }

  if (workspace.creator.toString() !== req.user._id.toString()) {
    return res
      .status(401)
      .json({ success: false, mes: 'REQUIRE CREATOR ROLE' });
  }

  req.workspace = workspace;
  next();
};

// admin của workspace (<creator)
exports.isAdminWorkspace = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const workspace = await Workspace.findById(id).populate({
    path: 'members',
    model: 'Membership',
  });

  if (!workspace) {
    return res
      .status(404)
      .json({ success: false, mes: 'Workspace không tồn tại' });
  }

  const isCreator = workspace.creator.toString() === userId.toString();

  const member = workspace.members.find(
    (m) =>
      m.userId.toString() === userId.toString() && m.role === 'adminWorkspace'
  );

  if (!isCreator && !member) {
    return res.status(401).json({
      success: false,
      mes: 'REQUIRE ADMIN WORKSPACE ROLE OR CREATOR',
    });
  }

  req.workspace = workspace;
  next();
};

// creator của board/project
exports.isCreatorBoard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const boardId = req.params.id; // hoặc req.body.boardId tuỳ route

    const board = await Board.findById(boardId);
    if (!board) {
      return res
        .status(404)
        .json({ success: false, message: 'Board không tồn tại' });
    }

    if (board.creator.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({
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
    const boardId = req.params.id; // hoặc req.body.boardId tuỳ route

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
      return res
        .status(403)
        .json({
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
