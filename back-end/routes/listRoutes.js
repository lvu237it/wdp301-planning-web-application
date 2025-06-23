const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

const { protect } = require('../utils/auth');
router.get('/', listController.getAllList);
router.get('/board/:boardId', protect, listController.getListsByBoard);
router.get('/:id', listController.getListById);
router.post('/createList', listController.createList);
router.put('/updateList/:id', listController.updateList);
router.delete('/deleteList/:id', listController.deleteList);

module.exports = router;
