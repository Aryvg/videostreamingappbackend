const express = require('express');
const router = express.Router();
const { forgotPassword } = require('../controllers/forgotPasswordController');
const rateLimit = require('../middleware/rateLimit');

router.use(rateLimit);
router.post('/', forgotPassword);

module.exports = router;
