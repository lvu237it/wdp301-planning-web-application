const express = require('express');
const router = express.Router({ mergeParams: true });
const skillController = require('../controllers/skillController');
const {
  protect,
} = require('../utils/auth');

router.get('/', protect, skillController.getAllSkills);



module.exports = router;
