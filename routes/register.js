const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');
const rateLimit = require('../middleware/rateLimit');
router.use(rateLimit);
router.get('/check-availability', registerController.checkEmailAvailability);
router.post('/', registerController.handleNewUser);
module.exports = router;

