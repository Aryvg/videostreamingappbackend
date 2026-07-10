const express = require('express');
const router = express.Router();
const { verifyEmail } = require('../controllers/verifyEmailController');
const rateLimit = require('../middleware/rateLimit');
router.use(rateLimit);
router.post('/', verifyEmail);
module.exports = router;
