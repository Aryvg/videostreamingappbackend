const express= require('express');
const router= express.Router();
const practiceController2= require('../../controllers/practiceController2');
const { practiceSanitization, handleValidationErrors } = require('../../middleware/sanitization');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
//const verifyJWT= require('../../middleware/verifyJWT');
router.use(rateLimit);
router.route('/')
       .get(practiceController2.getAllpractices)
       .post(
            upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
            practiceSanitization,
            handleValidationErrors,
            practiceController2.createNewpractice
       )
       .put(
            upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
            practiceSanitization,
            handleValidationErrors,
            practiceController2.updatepractice
       )
       .delete(practiceController2.deletepractice);
router.route('/:videoId')
     .get(practiceController2.getpractice)
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        practiceSanitization,
        handleValidationErrors,
        practiceController2.updatepractice
     )
module.exports=router;