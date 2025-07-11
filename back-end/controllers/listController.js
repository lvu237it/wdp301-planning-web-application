const List = require('../models/listModel');
const Board = require('../models/boardModel');
const mongoose = require('mongoose');
const NotificationService = require('../services/NotificationService');

// GET all lists for a specific board
exports.getAllList = async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'boardId không hợp lệ',
      });
    }
    const lists = await List.find({ boardId, isDeleted: false }).sort(
      'position'
    );
    res.status(200).json({
      status: 'success',
      results: lists.length,
      data: lists,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET a single list by id
exports.getListById = async (req, res) => {
  try {
    const { id } = req.params;
    const { boardId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: 'fail', message: 'ID không hợp lệ' });
    }
    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Không tìm thấy danh sách' });
    }
    if (boardId && list.boardId.toString() !== boardId) {
      return res
        .status(400)
        .json({ status: 'fail', message: 'boardId không khớp' });
    }

    res.status(200).json({ status: 'success', data: list });
  } catch (error) {
    console.error('Error in getListById:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// CREATE a new list
// exports.createList = async (req, res) => {
//   try {
//     const { title, boardId, position } = req.body;
//     if (!title || !boardId) {
//       return res
//         .status(400)
//         .json({ status: 'fail', message: 'title và boardId là bắt buộc' });
//     }
//     if (!mongoose.Types.ObjectId.isValid(boardId)) {
//       return res
//         .status(400)
//         .json({ status: 'fail', message: 'boardId không hợp lệ' });
//     }

//     // shift existing lists
//     if (typeof position === 'number') {
//       await List.updateMany(
//         { boardId, position: { $gte: position }, isDeleted: false },
//         { $inc: { position: 1 } }
//       );
//     }

//     // create
//     const newList = await List.create({
//       title,
//       boardId,
//       position: typeof position === 'number' ? position : 0,
//       tasks: [],
//       isDeleted: false,
//     });

//     // push to Board.lists array
//     await Board.findByIdAndUpdate(boardId, { $push: { lists: newList._id } });

//     res.status(201).json({ status: 'success', data: newList });
//   } catch (error) {
//     console.error('Error while creating list:', error);
//     res
//       .status(500)
//       .json({ status: 'error', message: 'Có lỗi xảy ra khi tạo danh sách' });
//   }
// };

exports.createList = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { title, boardId, position } = req.body;
    const userId = req.user._id;
    console.log('userId', userId);

    if (!title || !boardId) {
      throw new Error('title và boardId là bắt buộc');
    }
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      throw new Error('boardId không hợp lệ');
    }

    // Kiểm tra quyền truy cập board
    const membership = await mongoose.model('BoardMembership').findOne({
      boardId,
      userId,
      isDeleted: false,
      applicationStatus: 'accepted',
    });
    if (!membership || membership.role === 'read-only') {
      throw new Error('Không có quyền tạo danh sách');
    }

    // Shift existing lists
    if (typeof position === 'number') {
      await List.updateMany(
        { boardId, position: { $gte: position }, isDeleted: false },
        { $inc: { position: 1 } },
        { session }
      );
    }

    // Create list
    const listData = {
      title,
      boardId,
      position: typeof position === 'number' ? position : 0,
      tasks: [],
      isDeleted: false,
    };

    const newList = new List(listData);
    newList._userId = userId; // Gắn userId để middleware sử dụng
    await newList.save({ session });

    // Create activity log manually as backup
    // try {
    //   const ActivityLog = require('../models/activityLogModel');
    //   await ActivityLog.create({
    //     boardId: newList.boardId,
    //     userId: userId,
    //     action: 'list_created',
    //     targetId: newList._id,
    //     targetType: 'list',
    //     details: `List "${newList.title}" created in board ${newList.boardId}`,
    //     isVisible: true,
    //   });
    // } catch (logError) {
    //   console.error('Error creating manual activity log:', logError);
    // }

    // Push to Board.lists array
    await Board.findByIdAndUpdate(
      boardId,
      { $push: { lists: newList._id } },
      { session }
    );

    // Send notification to creator
    try {
      await NotificationService.createPersonalNotification({
        title: 'Tạo danh sách thành công',
        content: `Bạn đã tạo thành công danh sách "${title}"`,
        type: 'list_created',
        targetUserId: userId,
        targetWorkspaceId: null, // Will be populated from board if needed
        createdBy: userId,
      });
    } catch (notificationError) {
      console.warn(
        'Failed to send list creation notification:',
        notificationError
      );
    }

    await session.commitTransaction();
    res.status(201).json({ status: 'success', data: newList });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error while creating list:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Có lỗi xảy ra khi tạo danh sách' });
  } finally {
    session.endSession();
  }
};

// UPDATE list title or position
// exports.updateList = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { title, position } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res
//         .status(400)
//         .json({ status: 'fail', message: 'ID không hợp lệ' });
//     }
//     const list = await List.findOne({ _id: id, isDeleted: false });
//     if (!list) {
//       return res
//         .status(404)
//         .json({ status: 'fail', message: 'Không tìm thấy danh sách' });
//     }

//     // reposition within same board
//     if (typeof position === 'number' && position !== list.position) {
//       const boardId = list.boardId;
//       const oldPos = list.position;
//       const newPos = position < 0 ? 0 : position;
//       if (newPos > oldPos) {
//         await List.updateMany(
//           {
//             boardId,
//             position: { $gt: oldPos, $lte: newPos },
//             isDeleted: false,
//           },
//           { $inc: { position: -1 } }
//         );
//       } else {
//         await List.updateMany(
//           {
//             boardId,
//             position: { $gte: newPos, $lt: oldPos },
//             isDeleted: false,
//           },
//           { $inc: { position: 1 } }
//         );
//       }
//       list.position = newPos;
//     }

//     // rename
//     if (typeof title === 'string' && title.trim() !== '') {
//       list.title = title.trim();
//     }

//     const updatedList = await list.save();
//     res.status(200).json({ status: 'success', data: updatedList });
//   } catch (error) {
//     console.error('Error while updating list:', error);
//     res.status(500).json({
//       status: 'error',
//       message: 'Có lỗi xảy ra khi cập nhật danh sách',
//     });
//   }
// };

exports.updateList = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, position } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: 'fail', message: 'ID không hợp lệ' });
    }
    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      return res
        .status(404)
        .json({ status: 'fail', message: 'Không tìm thấy danh sách' });
    }

    // Kiểm tra quyền truy cập board
    const membership = await mongoose.model('BoardMembership').findOne({
      boardId: list.boardId,
      userId,
      isDeleted: false,
      applicationStatus: 'accepted',
    });
    if (!membership || membership.role === 'read-only') {
      return res
        .status(403)
        .json({ status: 'fail', message: 'Không có quyền cập nhật danh sách' });
    }

    // Reposition within same board
    if (typeof position === 'number' && position !== list.position) {
      const boardId = list.boardId;
      const oldPos = list.position;
      const newPos = position < 0 ? 0 : position;
      if (newPos > oldPos) {
        await List.updateMany(
          {
            boardId,
            position: { $gt: oldPos, $lte: newPos },
            isDeleted: false,
          },
          { $inc: { position: -1 } }
        );
      } else {
        await List.updateMany(
          {
            boardId,
            position: { $gte: newPos, $lt: oldPos },
            isDeleted: false,
          },
          { $inc: { position: 1 } }
        );
      }
      list.position = newPos;
    }

    // Rename
    if (typeof title === 'string' && title.trim() !== '') {
      list.title = title.trim();
    }

    list._userId = userId; // Gắn userId để middleware sử dụng
    const updatedList = await list.save();

    // Send notification to updater
    try {
      await NotificationService.createPersonalNotification({
        title: 'Cập nhật danh sách thành công',
        content: `Bạn đã cập nhật thành công danh sách "${updatedList.title}"`,
        type: 'list_updated',
        targetUserId: userId,
        targetWorkspaceId: null,
        createdBy: userId,
      });
    } catch (notificationError) {
      console.warn(
        'Failed to send list update notification:',
        notificationError
      );
    }

    res.status(200).json({ status: 'success', data: updatedList });
  } catch (error) {
    console.error('Error while updating list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra khi cập nhật danh sách',
    });
  }
};

// DELETE list
// exports.deleteList = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res
//         .status(400)
//         .json({ status: 'fail', message: 'ID không hợp lệ' });
//     }

//     const list = await List.findOne({ _id: id, isDeleted: false });
//     if (!list) {
//       return res
//         .status(404)
//         .json({ status: 'fail', message: 'Không tìm thấy danh sách' });
//     }
//     const { boardId, position: delPos } = list;

//     await List.deleteOne({ _id: id });

//     await Board.findByIdAndUpdate(
//       boardId,
//       { $pull: { lists: id } },
//       { new: true }
//     );

//     await List.updateMany(
//       { boardId, position: { $gt: delPos }, isDeleted: false },
//       { $inc: { position: -1 } }
//     );

//     res
//       .status(200)
//       .json({ status: 'success', message: 'Xóa danh sách thành công' });
//   } catch (error) {
//     console.error('Error while deleting list:', error);
//     res
//       .status(500)
//       .json({ status: 'error', message: 'Có lỗi xảy ra khi xóa danh sách' });
//   }
// };

// DELETE list - soft delete
exports.deleteList = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID không hợp lệ');
    }

    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      throw new Error('Không tìm thấy danh sách');
    }

    // Kiểm tra quyền truy cập board
    const membership = await mongoose.model('BoardMembership').findOne({
      boardId: list.boardId,
      userId,
      isDeleted: false,
      applicationStatus: 'accepted',
    });
    if (!membership || membership.role === 'read-only') {
      throw new Error('Không có quyền xóa danh sách');
    }

    const { boardId, position: delPos } = list;
    const listTitle = list.title; // Store title before deletion

    // Soft delete
    await List.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session, _userId: userId } // Gắn _userId để middleware sử dụng
    );

    // Remove from Board.lists
    await Board.findByIdAndUpdate(
      boardId,
      { $pull: { lists: id } },
      { session }
    );

    // Adjust positions
    await List.updateMany(
      { boardId, position: { $gt: delPos }, isDeleted: false },
      { $inc: { position: -1 } },
      { session }
    );

    // Send notification to deleter
    try {
      await NotificationService.createPersonalNotification({
        title: 'Xóa danh sách thành công',
        content: `Bạn đã xóa thành công danh sách "${listTitle}"`,
        type: 'list_deleted',
        targetUserId: userId,
        targetWorkspaceId: null,
        createdBy: userId,
      });
    } catch (notificationError) {
      console.warn(
        'Failed to send list deletion notification:',
        notificationError
      );
    }

    await session.commitTransaction();
    res
      .status(200)
      .json({ status: 'success', message: 'Xóa danh sách thành công' });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error while deleting list:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Có lỗi xảy ra khi xóa danh sách' });
  } finally {
    session.endSession();
  }
};

// GET lists by boardId - API đặc biệt cho BoardCalendar
exports.getListsByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'boardId không hợp lệ',
      });
    }

    const lists = await List.find({ boardId, isDeleted: false })
      .sort('position')
      .select('_id title color position');

    res.status(200).json({
      status: 'success',
      results: lists.length,
      data: lists,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// MOVE task between lists
exports.moveTask = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { taskId, sourceListId, destinationListId, position } = req.body;
    const userId = req.user._id;

    if (
      !mongoose.Types.ObjectId.isValid(taskId) ||
      !mongoose.Types.ObjectId.isValid(sourceListId) ||
      !mongoose.Types.ObjectId.isValid(destinationListId)
    ) {
      throw new Error(
        'taskId, sourceListId hoặc destinationListId không hợp lệ'
      );
    }

    const sourceList = await List.findOne({
      _id: sourceListId,
      isDeleted: false,
    });
    const destinationList = await List.findOne({
      _id: destinationListId,
      isDeleted: false,
    });

    if (!sourceList || !destinationList) {
      throw new Error('Không tìm thấy danh sách nguồn hoặc đích');
    }

    if (sourceList.boardId.toString() !== destinationList.boardId.toString()) {
      throw new Error('Danh sách nguồn và đích phải thuộc cùng một board');
    }

    // Kiểm tra quyền truy cập board
    const membership = await mongoose.model('BoardMembership').findOne({
      boardId: sourceList.boardId,
      userId,
      isDeleted: false,
      applicationStatus: 'accepted',
    });
    if (!membership || membership.role === 'read-only') {
      throw new Error('Không có quyền di chuyển task');
    }

    // Kiểm tra task tồn tại trong danh sách nguồn
    if (!sourceList.tasks.includes(taskId)) {
      throw new Error('Task không tồn tại trong danh sách nguồn');
    }

    // Xóa task khỏi danh sách nguồn
    await List.findOneAndUpdate(
      { _id: sourceListId, isDeleted: false },
      { $pull: { tasks: taskId } },
      { session, _userId: userId }
    );

    // Thêm task vào danh sách đích tại vị trí chỉ định
    await List.findOneAndUpdate(
      { _id: destinationListId, isDeleted: false },
      { $push: { tasks: { $each: [taskId], $position: position || 0 } } },
      { session, _userId: userId }
    );

    await session.commitTransaction();
    res
      .status(200)
      .json({ status: 'success', message: 'Di chuyển task thành công' });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error while moving task:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Có lỗi xảy ra khi di chuyển task' });
  } finally {
    session.endSession();
  }
};
