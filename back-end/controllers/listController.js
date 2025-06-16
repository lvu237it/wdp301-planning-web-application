const List = require('../models/listModel');
const Board = require('../models/boardModel');
const mongoose = require('mongoose');

// GET all lists for a specific board
exports.getAllList = async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'boardId không hợp lệ'
      });
    }
    const lists = await List.find({ boardId, isDeleted: false })
                            .sort('position');
    res.status(200).json({
      status: 'success',
      results: lists.length,
      data: lists
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
      return res.status(400).json({ status: 'fail', message: 'ID không hợp lệ' });
    }
    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      return res.status(404).json({ status: 'fail', message: 'Không tìm thấy danh sách' });
    }
    if (boardId && list.boardId.toString() !== boardId) {
      return res.status(400).json({ status: 'fail', message: 'boardId không khớp' });
    }

    res.status(200).json({ status: 'success', data: list });
  } catch (error) {
    console.error('Error in getListById:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// CREATE a new list
exports.createList = async (req, res) => {
  try {
    const { title, boardId, position } = req.body;
    if (!title || !boardId) {
      return res.status(400).json({ status: 'fail', message: 'title và boardId là bắt buộc' });
    }
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ status: 'fail', message: 'boardId không hợp lệ' });
    }

    // shift existing lists
    if (typeof position === 'number') {
      await List.updateMany(
        { boardId, position: { $gte: position }, isDeleted: false },
        { $inc: { position: 1 } }
      );
    }

    // create
    const newList = await List.create({ title, boardId, position: typeof position === 'number' ? position : 0, tasks: [], isDeleted: false });

    // push to Board.lists array
    await Board.findByIdAndUpdate(boardId, { $push: { lists: newList._id } });

    res.status(201).json({ status: 'success', data: newList });
  } catch (error) {
    console.error('Error while creating list:', error);
    res.status(500).json({ status: 'error', message: 'Có lỗi xảy ra khi tạo danh sách' });
  }
};

// UPDATE list title or position
exports.updateList = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, position } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'fail', message: 'ID không hợp lệ' });
    }
    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      return res.status(404).json({ status: 'fail', message: 'Không tìm thấy danh sách' });
    }

    // reposition within same board
    if (typeof position === 'number' && position !== list.position) {
      const boardId = list.boardId;
      const oldPos = list.position;
      const newPos = position < 0 ? 0 : position;
      if (newPos > oldPos) {
        await List.updateMany(
          { boardId, position: { $gt: oldPos, $lte: newPos }, isDeleted: false },
          { $inc: { position: -1 } }
        );
      } else {
        await List.updateMany(
          { boardId, position: { $gte: newPos, $lt: oldPos }, isDeleted: false },
          { $inc: { position: 1 } }
        );
      }
      list.position = newPos;
    }

    // rename
    if (typeof title === 'string' && title.trim() !== '') {
      list.title = title.trim();
    }

    const updatedList = await list.save();
    res.status(200).json({ status: 'success', data: updatedList });
  } catch (error) {
    console.error('Error while updating list:', error);
    res.status(500).json({ status: 'error', message: 'Có lỗi xảy ra khi cập nhật danh sách' });
  }
};

// DELETE list
exports.deleteList = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'fail', message: 'ID không hợp lệ' });
    }

    const list = await List.findOne({ _id: id, isDeleted: false });
    if (!list) {
      return res.status(404).json({ status: 'fail', message: 'Không tìm thấy danh sách' });
    }
    const { boardId, position: delPos } = list;

    
    await List.deleteOne({ _id: id });

    await Board.findByIdAndUpdate(
      boardId,
      { $pull: { lists: id } },
      { new: true }
    );

    await List.updateMany(
      { boardId, position: { $gt: delPos }, isDeleted: false },
      { $inc: { position: -1 } }
    );

    res.status(200).json({ status: 'success', message: 'Xóa danh sách thành công' });
  } catch (error) {
    console.error('Error while deleting list:', error);
    res.status(500).json({ status: 'error', message: 'Có lỗi xảy ra khi xóa danh sách' });
  }
};
