const express= require('express');
const router= express.Router();
const employeesController= require('../../controllers/employeesController');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
//const verifyJWT= require('../../middleware/verifyJWT');
const { employeeSanitization, handleValidationErrors } = require('../../controllers/employeesController');
router.use(rateLimit);
router.route('/')
     .get(employeesController.getAllEmployees)
     .post(
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        employeeSanitization,
        handleValidationErrors,
        employeesController.createNewEmployee
     )
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        employeeSanitization,
        handleValidationErrors,
        employeesController.updateEmployee
     )
     .delete(employeesController.deleteEmployee);
router.route('/:videoId')
     .get(employeesController.getEmployee)
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        employeeSanitization,
        handleValidationErrors,
        employeesController.updateEmployee
     );
module.exports=router;