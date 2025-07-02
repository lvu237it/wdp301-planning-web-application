const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

const { protect } = require('../utils/auth');
router.get('/', protect, listController.getAllList);
router.get('/board/:boardId', protect, listController.getListsByBoard);
router.get('/:id', protect, listController.getListById);
router.post('/createList', protect, listController.createList);
router.put('/updateList/:id', protect, listController.updateList);
router.delete('/deleteList/:id', protect, listController.deleteList);

module.exports = router;
