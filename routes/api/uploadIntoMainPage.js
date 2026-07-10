const express = require('express');
const multer = require('multer');
const router = express.Router();
const uploadIntoMainPageController = require('../../controllers/uploadIntoMainPageController');
const { uploadMainPage } = require('../../config/multerCloudinary');
const ROLES_LIST = require('../../config/roles-list');
const verifyRoles = require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
const { uploadIntoMainPageSanitization, handleValidationErrors } = require('../../controllers/uploadIntoMainPageController');

router.use(rateLimit);

router.route('/')
    .get(uploadIntoMainPageController.getAllUploadIntoMainPage)
    .post(
        uploadMainPage.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'videoFile', maxCount: 1 }]),
        uploadIntoMainPageSanitization,
        handleValidationErrors,
        uploadIntoMainPageController.createNewUploadIntoMainPage
    )
    .put(
        uploadMainPage.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'videoFile', maxCount: 1 }]),
        uploadIntoMainPageSanitization,
        handleValidationErrors,
        uploadIntoMainPageController.updateUploadIntoMainPage
    )
    .delete(uploadIntoMainPageController.deleteUploadIntoMainPage);

router.route('/:itemId')
    .get(uploadIntoMainPageController.getUploadIntoMainPage)
    .put(
        uploadMainPage.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'videoFile', maxCount: 1 }]),
        uploadIntoMainPageSanitization,
        handleValidationErrors,
        uploadIntoMainPageController.updateUploadIntoMainPage
    );

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err?.statusCode === 400) {
        return res.status(400).json({ message: err.message || 'Invalid upload.' });
    }
    next(err);
});

module.exports = router;
