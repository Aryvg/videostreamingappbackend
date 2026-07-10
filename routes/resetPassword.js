const express = require('express');
const router = express.Router();
const { resetPassword } = require('../controllers/resetPasswordController');
const rateLimit = require('../middleware/rateLimit');

router.use(rateLimit);
router.post('/', resetPassword);

module.exports = router;
