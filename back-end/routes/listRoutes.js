const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

const { protect } = require('../utils/auth');

router.post('/createList', listController.createList);
router.put('/updateList/:id', listController.updateList);
router.delete('/deleteList/:id', listController.deleteList);

module.exports = router;
