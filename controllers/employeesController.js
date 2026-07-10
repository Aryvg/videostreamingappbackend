const Employee = require('../model/Employee');
const fs = require('fs');
const crypto = require('crypto'); // for generating videoId
const path = require('path');
const { employeeSanitization, handleValidationErrors } = require('../middleware/sanitization');

// Reusable function to validate comments, preserving all comments in the logic
function validateAndStringifyComments(comments, res) {
    // Only accept arrays
    if (!Array.isArray(comments)) {
        return res.status(400).json({ message: 'Comments must be an array.' });
    }
    // Ensure all comments are strings and each is <= 10,000 chars
    for (const c of comments) {
        if (typeof c !== 'string') {
            return res.status(400).json({ message: 'All comments must be strings.' });
        }
        if (c.length > 10000) {
            return res.status(400).json({ message: 'Each comment must not exceed 10,000 characters.' });
        }
    }
    return comments;
}

// Reusable function to validate skills, preserving all comments in the logic
function validateAndStringifySkills(skills, res) {
    // If skills is a string, reject
    if (typeof skills === 'string') {
        return res.status(400).json({ message: 'Skills must be an object, not a string.' });
    }
    // If skills is an array, reject
    if (Array.isArray(skills)) {
        return res.status(400).json({ message: 'Skills must be an object, not an array.' });
    }
    // If skills is an object, check each value's length like {"skill1": "value1", "skill2": "value2"}
    if (typeof skills === 'object' && skills !== null) {
        for (const key in skills) {
            if (Object.prototype.hasOwnProperty.call(skills, key)) {
                const value = skills[key];
                if (typeof value !== 'string' || value.length > 100) {
                    return res.status(400).json({ message: `Skill '${key}' must be a string and not exceed 100 characters.` });
                }
            }
        }
        return skills;
    }
    // If skills is not a string, array, or object, reject
    return res.status(400).json({ message: 'Invalid skills format.' });
}

const makeImageUrl = (imgPath, req) => {
    if (!imgPath) return '';
    if (typeof imgPath !== 'string') return '';
    const trimmed = imgPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    // ensure no leading slash duplication
    const clean = trimmed.replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${clean}`;
}

const makeMediaUrl = (mediaPath, req) => {
    if (!mediaPath) return '';
    if (typeof mediaPath !== 'string') return '';
    const trimmed = mediaPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    // if path contains directories, use basename and route through media controller
    const base = path.basename(trimmed);
    return `${req.protocol}://${req.get('host')}/media/file/${encodeURIComponent(base)}`;
}

const getAllEmployees = async (req, res) => {
    const employees = await Employee.find().lean();//get all employees from database
    if (!employees || employees.length === 0) return res.status(204).json({ 'message': 'No employees found.' }); //if no employees are found, return 204(empty).

    const mapped = employees.map(e => ({
        ...e,
        image: makeImageUrl(e.image, req),
        video: makeMediaUrl(e.video, req)
    }));
    res.json(mapped);
    // convert image and video paths to URLS (images from cloudinary, videos from cloudinary)
}

const createNewEmployee = async (req, res) => {
    // For multipart/form-data, fields are in req.body, files in req.files
    if (!req?.body?.firstname || !req?.body?.lastname || !req?.body?.job) {
        return res.status(400).json({ 'message': 'First and last names are required' }); //400 means bad request
    }
    // Validate field lengths
    if (req.body.firstname.length > 50) {
        return res.status(400).json({ message: 'Firstname must not exceed 50 characters.' });
    }
    if (req.body.lastname.length > 50) {
        return res.status(400).json({ message: 'Lastname must not exceed 50 characters.' });
    }
    if (req.body.job.length > 50) {
        return res.status(400).json({ message: 'Job must not exceed 50 characters.' });
    }

    try {
        // Parse comments if sent as JSON string
        //JSON.parse convert json to js object
        //JSON.stringify convert js object to json
        let comments = undefined;
        if (req.body.comments) {
            try {
                comments = JSON.parse(req.body.comments);// means let the json file the user sends be changed to object so that it can be used in code because json can not be used in code like to loop.
            } catch (e) {
                comments = req.body.comments;
            }
            // Use the reusable validation function
            const cleanedComments = validateAndStringifyComments(comments, res);
            if (!cleanedComments) return;
            comments = cleanedComments;// means use the safe version only or use the validated version only
        } //The frontend sends a json file or string. if (req.body.comments)  means if user sends comment, let that comment be req.body.comments. otherwise let it be undefined.
        let skills = req.body?.skills ? req.body.skills : undefined;
        //if skills exist store them and if not, leave them undefined.
        //req.body?.skills means go to .skills only if req.body(which is the api) exists if were just said req.body.skills, it would be undefined.skills if the api did not exist which brings an error
        if (skills) {
            const cleanedSkills = validateAndStringifySkills(skills, res);
            if (!cleanedSkills) return;
            skills = cleanedSkills;
        }

        // Handle image and video Cloudinary URLs
        let imagePath = req.body.image;
        let videoPath = req.body.video;
        if (req.files && req.files.image && req.files.image[0]) {
            imagePath = req.files.image[0].path; // Cloudinary URL
        }
        if (req.files && req.files.video && req.files.video[0]) {
            videoPath = req.files.video[0].path; // Cloudinary URL
        }

        const result = await Employee.create({
            videoId: crypto.randomUUID(),
            firstname: req.body.firstname,
            video: videoPath,
            lastname: req.body.lastname,
            job: req.body.job,
            image: imagePath,
            ...(comments && { comments }), //means take every comment and copy it
            ...(skills && { skills }),
            createdBy: req.user // set creator from verifyJWT middleware
        });

        res.status(201).json(result);// 201 is success
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}

const updateEmployee = async (req, res) => {
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    //req.params means /employees/123
    //req.query means /employees?videoId=123
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }

    const employee = await Employee.findOne({ videoId }).exec(); //gets employee related with the above videoId from the db
    if (!employee) {
        return res.status(204).json({ "message": `No employee matches videoId ${videoId}.` });
    } //204 means server successfully processed but has no data to return
    if (req.body?.firstname) {
        if (req.body.firstname.length > 50) {
            return res.status(400).json({ message: 'Firstname must not exceed 50 characters.' });
        }
        employee.firstname = req.body.firstname;
    }
    //replace the old with the new
    if (req.body?.lastname) {
        if (req.body.lastname.length > 50) {
            return res.status(400).json({ message: 'Lastname must not exceed 50 characters.' });
        }
        employee.lastname = req.body.lastname;
    }
    if (req.body?.job) {
        if (req.body.job.length > 50) {
            return res.status(400).json({ message: 'Job must not exceed 50 characters.' });
        }
        employee.job = req.body.job;
    }

    // Handle comments (parse if JSON string)
    if (req.body?.comments) {
        let comments = req.body.comments;
        if (typeof comments === 'string') {
            try { comments = JSON.parse(comments); } catch (e) { }
        }//if comments is string, change it to real object or array
        //to understand real object, consider this
        //user sends  good job
        //backend receives "good job"
        // it becomes  "["good job"]" because we say in the frontend json.stringify
        // We make JSON.parse(comments) to convert "["good job"]"" to ["good job"]
        //catch (e) {} means if it fails, do nothing

        // Use the reusable validation function
        const cleanedComments = validateAndStringifyComments(comments, res);
        if (!cleanedComments) return;// the use of this is that it stops bad data from being saved in the db.
        comments = cleanedComments;
        if (Array.isArray(comments)) {// means if a comment is an array
            employee.comments = comments;//replace the old with the new
        }
    }

    if (req.body?.skills) {
        let skills = req.body.skills;
        const cleanedSkills = validateAndStringifySkills(skills, res);
        if (!cleanedSkills) return;
        skills = cleanedSkills;
        const existing = employee.skills && typeof employee.skills.entries === 'function'
            ? Object.fromEntries(employee.skills)
            : (employee.skills || {});// what this does is update skills without deleting old skills
        employee.skills = { ...existing, ...skills };
        //existing is the old skills and we copy them and next to them we add the new skills we want to add
    }

    // Handle image and video file replacement (Cloudinary URLs)
    if (req.files && req.files.image && req.files.image[0]) {
        employee.image = req.files.image[0].path; // Cloudinary URL
    }
    if (req.files && req.files.video && req.files.video[0]) {
        employee.video = req.files.video[0].path; // Cloudinary URL
    }

    const result = await employee.save();
    res.json(result);
}

const deleteEmployee = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const employee = await Employee.findOne({ videoId }).exec();
    if (!employee) {
        return res.status(204).json({ "message": `No employee matches videoId ${videoId}.` });
    }

    // Delete image file if exists
    if (employee.image) {
        const imgPath = employee.image.startsWith('images/') ? employee.image : '';
        if (imgPath) {
            const fullImgPath = require('path').join(__dirname, '../public', imgPath);
            if (fs.existsSync(fullImgPath)) {
                try { fs.unlinkSync(fullImgPath); } catch (e) { /* ignore */ }
            }
        }
    }
    // Delete video file if exists
    if (employee.video) {
        const vidPath = employee.video.startsWith('videos/') ? employee.video : '';
        if (vidPath) {
            const fullVidPath = require('path').join(__dirname, '..', vidPath);
            if (fs.existsSync(fullVidPath)) {
                try { fs.unlinkSync(fullVidPath); } catch (e) { /* ignore */ }
            }
        }
    }

    const result = await employee.deleteOne(); //{ _id: req.body.id }
    res.json(result);
}

const getEmployee = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const employee = await Employee.findOne({ videoId }).lean();
    if (!employee) {
        return res.status(204).json({ "message": `No employee matches videoId ${videoId}.` });
    }
    employee.image = makeImageUrl(employee.image, req);// change the url to http...
    employee.video = makeMediaUrl(employee.video, req);
    res.json(employee);
}

// know here that making the frontend get a real format text which is not sanitized is handled by the frontend. if the user sends <script></script> as a comment, the frontend should show it as <script></script> and not as &lt;script&gt;&lt;/script&gt; because the backend sanitizes it to prevent code injection but the frontend should show the real text which is <script></script> and not the sanitized version. so the frontend should convert &lt; to < and &gt; to > and so on when displaying comments and skills. this way we can prevent code injection while still showing the real text to users.
module.exports = {
    getAllEmployees,
    createNewEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployee,
    employeeSanitization,
    handleValidationErrors
}