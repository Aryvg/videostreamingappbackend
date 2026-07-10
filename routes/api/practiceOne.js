const express= require('express');
const router= express.Router();
const practiceController= require('../../controllers/practiceController');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
//const verifyJWT= require('../../middleware/verifyJWT');
router.use(rateLimit);
const { practiceSanitization, handleValidationErrors } = require('../../middleware/sanitization');
router.route('/')
     .get(practiceController.getAllusers)
     .post(
      practiceSanitization,
        handleValidationErrors,
        practiceController.createNewuser
     )
     .put(
      practiceSanitization,
        handleValidationErrors,
        practiceController.updateuser
     )
     .delete(practiceController.deleteuser);
router.route('/:videoId')
     .get(practiceController.getuser)
     .put(
      practiceSanitization,
        handleValidationErrors,
        practiceController.updateuser
     );
module.exports=router;