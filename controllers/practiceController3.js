// Validation function for create/update
function validatePracticeModel3Input(req, res) {
    // firstname, lastname, job: max 50 chars
    const fields = ['firstname', 'lastname', 'job'];
    for (const field of fields) {
        if (field in req.body && typeof req.body[field] === 'string' && req.body[field].length > 50) {
            res.status(400).json({ message: `${field} must not exceed 50 characters.` });
            return false;
        }
    }
    // views: must not be sent by user
    if ('views' in req.body) {
        res.status(400).json({ message: 'views cannot be set or updated by the user.' });
        return false;
    }
    // comments: must be array, each item must be object
    if ('comments' in req.body) {
        let comments = req.body.comments;
        if (typeof comments === 'string') {
            try { comments = JSON.parse(comments); } catch (e) {}
        }
        if (!Array.isArray(comments)) {
            res.status(400).json({ message: 'comments must be an array.' });
            return false;
        }
        for (const c of comments) {
            if (typeof c !== 'object' || c === null || Array.isArray(c)) {
                res.status(400).json({ message: 'Each comment must be an object.' });
                return false;
            }
        }
    }
    return true;
}
const practiceModel3 = require('../model/practiceModel3');
const fs = require('fs');
const crypto = require('crypto'); // for generating videoId
const path = require('path');
const { randomUUID } = require('crypto');

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

const getAllpracticeModel3s = async (req, res) => {
    const practiceModel3s = await practiceModel3.find().lean();//get all practiceModel3s from database
    if (!practiceModel3s || practiceModel3s.length === 0) return res.status(204).json({ 'message': 'No practiceModel3s found.' }); //if no practiceModel3s are found, return 204(empty).

    const mapped = practiceModel3s.map(e => {
        // Convert top-level image and video
        const newObj = { ...e, image: makeImageUrl(e.image, req), video: makeMediaUrl(e.video, req) };
        // Convert image and video in comments array if present
        if (Array.isArray(newObj.comments)) {
            newObj.comments = newObj.comments.map(comment => {
                const newComment = { ...comment };
                if (newComment.image) newComment.image = makeImageUrl(newComment.image, req);
                if (newComment.video) newComment.video = makeMediaUrl(newComment.video, req);
                return newComment;
            });
        }
        return newObj;
    });
    res.json(mapped);
    // convert image and video paths to URLS (images from cloudinary, videos from cloudinary)
}

const createNewpracticeModel3 = async (req, res) => {
    if (!validatePracticeModel3Input(req, res)) return;
    // For multipart/form-data, fields are in req.body, files in req.files
    if (!req?.body?.firstname || !req?.body?.lastname || !req?.body?.job || !req?.body?.address) {
        return res.status(400).json({ 'message': 'First and last names, job, and address are required' }); //400 means bad request
    }

    try {
        // Parse comments if sent as JSON string
        let comments = undefined;
        if (req.body.comments) {
            try {
                comments = JSON.parse(req.body.comments);
            } catch (e) {
                comments = req.body.comments;
            }
        }
        // Ensure each comment has a unique contentId
        if (Array.isArray(comments)) {
            // const { randomUUID } = require('crypto');
            comments = comments.map(comment => ({
                ...comment,
                contentId:  randomUUID()
            }));
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

        const result = await practiceModel3.create({
            videoId: crypto.randomUUID(),
            firstname: req.body.firstname,
            video: videoPath,
            lastname: req.body.lastname,
            job: req.body.job,
            address: req.body.address,
            image: imagePath,
            ...(comments && { comments }),
            createdBy: req.user // set creator from verifyJWT middleware
        });

        res.status(201).json(result);// 201 is success
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}

const updatepracticeModel3 = async (req, res) => {
    if (!validatePracticeModel3Input(req, res)) return;
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }

    const practiceDoc = await practiceModel3.findOne({ videoId }).exec();// the item connected to the videoId
    if (!practiceDoc) {
        return res.status(204).json({ "message": `No practiceModel3 matches videoId ${videoId}.` });
    }

    // Update basic fields
    if (req.body?.firstname) practiceDoc.firstname = req.body.firstname;
    if (req.body?.lastname) practiceDoc.lastname = req.body.lastname;
    if (req.body?.job) practiceDoc.job = req.body.job;
    if (req.body?.address) practiceDoc.address = req.body.address;

    // Update image and video from body if provided
    if (req.body?.image) practiceDoc.image = req.body.image;
    if (req.body?.video) practiceDoc.video = req.body.video;

    // Handle image and video file replacement (Cloudinary URLs)
    if (req.files && req.files.image && req.files.image[0]) {
        practiceDoc.image = req.files.image[0].path; // Cloudinary URL
    }
    if (req.files && req.files.video && req.files.video[0]) {
        practiceDoc.video = req.files.video[0].path; // Cloudinary URL
    }

    // Handle comments (parse if JSON string)
    if (req.body?.comments) {
        let comments = req.body.comments;
        if (typeof comments === 'string') {
            try { comments = JSON.parse(comments); } catch (e) {}
        }
        if (Array.isArray(comments)) {
            // Ensure each comment has a unique contentId (uuid)
            // const { randomUUID } = require('crypto');
            practiceDoc.comments = comments.map(comment => {
                return {
                    ...comment,
                    contentId:  randomUUID(),
                    //comment.contentId ||
                    // Allow updating contentImage/contentVideo from body
                    contentImage: comment.contentImage || '',
                    contentVideo: comment.contentVideo || ''
                };
            });
        }// this one wipes out and replaces fully like if we say in the request
        /*
        {"videoId":"592ff0f4-2cc4-4a34-92e6-e5e3840eb6bf",
         "comments":[
    {
      "contentImage": "images/replaced.png",
      "contentVideo": "videos/replaced.mp4",
      "views": 55
    }
  ]}, //it replaces the whole comments array.
        */
    } else if (practiceDoc.comments && Array.isArray(practiceDoc.comments)) {
        // Only update a specific comment if both contentId and videoId are provided
        if (req.body?.contentId && req.body?.videoId) {
            practiceDoc.comments = practiceDoc.comments.map(comment => {
                if (comment.contentId === req.body.contentId) {
                    let updated = { ...comment };
                    if (req.body?.contentImage) updated.contentImage = req.body.contentImage;
                    if (req.body?.contentVideo) updated.contentVideo = req.body.contentVideo;
                    // Ensure contentId is present
                    if (!updated.contentId) updated.contentId = require('crypto').randomUUID();
                    return updated;
                }
                return comment;
            });
        }
        // If contentId is not provided, do not update comments array
    }// EDIT existing comments wihtout deleting them the whole like if we say {"contentImage":"image.png"}, it only updates the contentImage of the item whose contentId is similar to the contentId we sent without changing the other things in comments.

    

    const result = await practiceDoc.save();
    res.json(result);
}

const deletepracticeModel3 = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const doc = await practiceModel3.findOne({ videoId }).exec();
    if (!doc) {
        return res.status(204).json({ "message": `No practiceModel3 matches videoId ${videoId}.` });
    }

    // Delete image file if exists
    if (doc.image) {
        const imgPath = doc.image.startsWith('images/') ? doc.image : '';
        if (imgPath) {
            const fullImgPath = require('path').join(__dirname, '../public', imgPath);
            if (fs.existsSync(fullImgPath)) {
                try { fs.unlinkSync(fullImgPath); } catch (e) { /* ignore */ }
            }
        }
    }
    // Delete video file if exists
    if (doc.video) {
        const vidPath = doc.video.startsWith('videos/') ? doc.video : '';
        if (vidPath) {
            const fullVidPath = require('path').join(__dirname, '..', vidPath);
            if (fs.existsSync(fullVidPath)) {
                try { fs.unlinkSync(fullVidPath); } catch (e) { /* ignore */ }
            }
        }
    }

    const result = await doc.deleteOne(); //{ _id: req.body.id }
    res.json(result);
}

const getpracticeModel3 = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const doc = await practiceModel3.findOne({ videoId }).lean();
    if (!doc) {
        return res.status(204).json({ "message": `No practiceModel3 matches videoId ${videoId}.` });
    }
    doc.image = makeImageUrl(doc.image, req);// change the url to http...
    doc.video = makeMediaUrl(doc.video, req);
    res.json(doc);
}

module.exports = {
    getAllpracticeModel3s,
    createNewpracticeModel3,
    updatepracticeModel3,
    deletepracticeModel3,
    getpracticeModel3
}