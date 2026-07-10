const express= require('express');
const router= express.Router();
const practiceController3= require('../../controllers/practiceController3');
const { employeeSanitization } = require('../../middleware/sanitization');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
//const verifyJWT= require('../../middleware/verifyJWT');
router.use(rateLimit);
router.route('/')
      .get(practiceController3.getAllpracticeModel3s)
      .post(
           upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
           employeeSanitization,
           practiceController3.createNewpracticeModel3
      )
      .put(
           upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
           employeeSanitization,
           practiceController3.updatepracticeModel3
      )
      .delete(practiceController3.deletepracticeModel3);
router.route('/:videoId')
     .get(practiceController3.getpracticeModel3)
     .put(
         upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
         employeeSanitization,
         practiceController3.updatepracticeModel3
     )
module.exports=router;