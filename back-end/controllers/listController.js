const List = require('../models/listModel');
const mongoose = require('mongoose');

// get all list
exports.getAllList = async (req, res) => {
  try {
    const lists = await List.find({ isDeleted: false }).sort('position');
    res.status(200).json({
      status: 'success',
      results: lists.length,
      data: lists
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
};

exports.getListById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'ID không hợp lệ',
      });
    }

    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy danh sách',
      });
    }

    res.status(200).json({
      status: 'success',
      data: list,
    });
  } catch (error) {
    console.error('Error while getting list by ID:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

// createList
exports.createList = async (req, res) => {
  try {
    const { title, boardId, position } = req.body;

    if (!title || !boardId) {
      return res.status(400).json({
        status: 'fail',
        message: 'title và boardId là bắt buộc',
      });   
    }

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'boardId không hợp lệ',
      });
    }

    if (typeof position === 'number') {
      await List.updateMany(
        { boardId: boardId, position: { $gte: position }, isDeleted: false },
        { $inc: { position: 1 } }
      );
    }

    const newList = await List.create({
      title,
      boardId,
      position: typeof position === 'number' ? position : 0,
      tasks: [],       
      isDeleted: false 
    });

    res.status(201).json({
      status: 'success',
      data: newList,
    });
  } catch (error) {
    console.error('Error while creating list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra khi tạo danh sách',
    });
  }
};

// updateList 
exports.updateList = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, position } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'ID không hợp lệ',
      });
    }

    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy danh sách',
      });
    }

    if (typeof position === 'number' && position !== list.position) {
      const boardId = list.boardId;
      const oldPosition = list.position;
      const newPosition = position < 0 ? 0 : position; 

      if (newPosition > oldPosition) {
        await List.updateMany(
          {
            boardId,
            position: { $gt: oldPosition, $lte: newPosition },
            isDeleted: false,
          },
          { $inc: { position: -1 } }
        );
      } else {
        await List.updateMany(
          {
            boardId,
            position: { $gte: newPosition, $lt: oldPosition },
            isDeleted: false,
          },
          { $inc: { position: 1 } }
        );
      }

      list.position = newPosition;
    }

    if (typeof title === 'string' && title.trim() !== '') {
      list.title = title.trim();
    }

    const updatedList = await list.save();

    res.status(200).json({
      status: 'success',
      data: updatedList,
    });
  } catch (error) {
    console.error('Error while updating list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra khi cập nhật danh sách',
    });
  }
};

// deleteList 
exports.deleteList = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'ID không hợp lệ',
      });
    }

    if (!list) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy danh sách',
      });
    }

    const boardId = list.boardId;
    const deletedPosition = list.position;

    await List.deleteOne({ _id: id });
    await List.updateMany(
      {
        boardId,
        position: { $gt: deletedPosition }
      },
      { $inc: { position: -1 } }
    );

    res.status(200).json({
      status: 'success',
      message: 'Xóa danh sách thành công',
    });
  } catch (error) {
    console.error('Error while deleting list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Có lỗi xảy ra khi xóa danh sách',
    });
  }
};