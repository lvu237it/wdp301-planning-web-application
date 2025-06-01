const mongoose = require('mongoose');
const crypto = require('crypto');
const Board = require('../models/boardModel');
const BoardMembership = require('../models/boardMembershipModel');
const User = require('../models/userModel');
const sendEmail = require('../utils/sendMail');
const WorkspaceMembership = require('../models/memberShipModel');

// get all boards theo workspaceId, boardId, visibility, isDeleted
exports.getAllBoards = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Lấy list workspaceId mà user thuộc về (membership của workspace)
    // Membership ở đây là model workspaceMembership (không phải boardMembership)
    
    const userWorkspaceDocs = await WorkspaceMembership.find({
      userId,
      invitationStatus: 'accepted',
      isDeleted: false,
    }).select('workspaceId');

    const workspaceIds = userWorkspaceDocs.map((doc) => doc.workspaceId);

    // 2. Lấy list boardId mà user đã được chấp nhận (boardMembership)
    const userBoardDocs = await BoardMembership.find({
      userId,
      applicationStatus: 'accepted',
      isDeleted: false,
    }).select('boardId');

    const boardIds = userBoardDocs.map((doc) => doc.boardId);

    // 3. Query trả ra:  
    //    - Các board có workspaceId ∈ workspaceIds và visibility = 'public'  
    //    - Hoặc board._id ∈ boardIds (bất kể visibility ra sao)  
    //    - Và tất cả đều phải isDeleted = false

    const boards = await Board.find({
      isDeleted: false,
      $or: [
        { 
          workspaceId: { $in: workspaceIds },
          visibility: 'public'
        },
        { 
          _id: { $in: boardIds }
        }
      ]
    }).populate('creator', 'username email') // (tuỳ chọn) fetch luôn người tạo
      .populate('workspaceId', 'name')       // (tuỳ chọn) fetch tên workspace
      .lean();

    return res.status(200).json({ boards });
  } catch (err) {
    console.error('Lỗi getAllBoards:', err);
    return res.status(500).json({
      message: 'Lỗi server khi lấy danh sách Board',
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
      workspaceId, 
      visibility,      // 'public' hoặc 'private'
      criteria         // object { skills: [...], yearOfExperience: {min,max}, workDuration: {min,max,unit} }
    } = req.body;
    const creatorId = req.user._id;

    // 1. Kiểm tra trường bắt buộc
    if (!name || !workspaceId || !visibility || !criteria) {
      throw new Error('Thiếu thông tin bắt buộc: name, workspaceId, visibility hoặc criteria');
    }

    // 2. Tạo Board
    //     - visibility đã được validate theo enum ['public','private']
    //     - criteria phải chứa đầy đủ các trường required theo schema
    const [newBoard] = await Board.create(
      [{
        name,
        description,
        creator: creatorId,
        workspaceId,
        visibility,
        criteria
      }],
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
        }
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
    const { id } = req.params;
    const updates = req.body;
    // updates có thể gồm: name, description, calendarId, visibility, criteria, backgroundColor, backgroundImage, v.v.

    // 1. Cập nhật trực tiếp (Mongoose sẽ validate các field mới)
    const board = await Board.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,   // đảm bảo validate theo schema
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
    const { id } = req.params;

    const board = await Board.findById(id);
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
    const { id } = req.params;

    const board = await Board.findByIdAndDelete(id);
    if (!board) {
      return res
        .status(404)
        .json({ message: 'Board không tồn tại hoặc đã bị xóa' });
    }

    // Mark tất cả BoardMembership liên quan thành deleted (optional)
    await BoardMembership.updateMany(
      { boardId: id },
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
    const { id: boardId } = req.params;
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

    // 6.1 Tìm membership theo token
    const membership = await BoardMembership.findOne({ invitationToken: token });
    if (!membership) {
      return res
        .status(400)
        .json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // 6.2 Đã xử lý rồi?
    if (membership.invitationResponse !== 'pending') {
      return res
        .status(400)
        .json({ message: 'Lời mời đã được xử lý trước đó' });
    }

    // 6.3 Xử lý action
    if (action === 'accept') {
      membership.invitationResponse = 'accepted';
      // Middleware pre 'save' sẽ tự set applicationStatus = 'applied' → 'accepted' → role = 'member'
    } else {
      membership.invitationResponse = 'declined';
      // Middleware pre 'save' sẽ tự đánh dấu isDeleted = true
    }

    membership.invitationToken = undefined;
    await membership.save();

    return res.status(200).json({
      message: `Bạn đã ${action === 'accept' ? 'chấp nhận' : 'từ chối'} lời mời vào Board.`,
      status: membership.invitationResponse,
    });
  } catch (err) {
    console.error('Lỗi khi xử lý invite-response:', err);
    res.status(500).json({
      message: 'Lỗi server khi phản hồi lời mời',
      error: err.message,
    });
  }
};

