const express = require('express');
const authenticationController = require('../controllers/authenticationController');
const router = express.Router();

//Router for business logic here
//default: /authentication
// router.get('/', handler);

router.post('/register', authenticationController.registerUser);
router.post('/login', authenticationController.loginUser);
router.post('/logout', authenticationController.logoutUser);
router.post('/forgotpass', authenticationController.forgotPassword);
router.post('/resetpass', authenticationController.resetPassword);

module.exports = router;
