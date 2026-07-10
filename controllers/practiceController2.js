const practice = require('../model/practiceModel.js');
const { practiceSanitization, handleValidationErrors } = require('../middleware/sanitization');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

function validateUserInput(req, res) {
    // Only validate fields that are present in the request body
    if ('views' in req.body) {
        res.status(400).json({ message: 'views cannot be set or updated by the user.' });
        return false;
    }
    if ('name' in req.body) {
        if (typeof req.body.name !== 'string' || req.body.name.length > 50 || req.body.name.trim().length === 0) {
            res.status(400).json({ message: 'Name must be a non-empty string and not exceed 50 characters.' });
            return false;
        }
    }
    if ('email' in req.body) {
        if (typeof req.body.email !== 'string' || !/^\S+@gmail\.com$/.test(req.body.email)) {
            res.status(400).json({ message: 'Email must be a valid gmail.com address.' });
            return false;
        }
    }
    if ('job' in req.body) {
        if (typeof req.body.job !== 'string' || req.body.job.length > 100 || req.body.job.trim().length === 0) {
            res.status(400).json({ message: 'Job must be a non-empty string and not exceed 100 characters.' });
            return false;
        }
    }
    // Validate userInfo/practiceInfo if present
    let userInfo = req.body.practiceInfo;// practiceInfo is the value that we can insert in place of userInfo, because in the schema we use practiceInfo as a Map to store channelName, views, Creator, etc. so if user send practiceInfo instead of userInfo, we can also validate it and store it in practiceInfo field in database.
    if (userInfo) {
        try {
            if (typeof userInfo === 'string') userInfo = JSON.parse(userInfo);
        } catch (e) {
            res.status(400).json({ message: 'userInfo/practiceInfo must be a valid object or JSON string.' });
            return false;
        }
        if (!validateUserInfo(userInfo, res, true)) {
            return false;
        }// means if userInfo is present and it is not valid, return false and return false means stop the execution of the function and return the response to the client.
    }
    return true;
}

// Reusable input validation function for userInfo
function validateUserInfo(userInfo, res, isCreate = false) {
    if (typeof userInfo === 'string') {
        res.status(400).json({ message: 'userInfo must not be a string.' });
        return false;
    }
    if (Array.isArray(userInfo)) {
        res.status(400).json({ message: 'userInfo must not be an array.' });
        return false;
    }
    if (typeof userInfo === 'object' && userInfo !== null) {
        // channelName
        if (!('channelName' in userInfo) || typeof userInfo.channelName !== 'string' || userInfo.channelName.trim().length === 0 || userInfo.channelName.length > 100) {
            res.status(400).json({ message: 'channelName in userInfo is required, must be a non-empty string, and not exceed 100 characters.' });
            return false;
        }
        // Creator
        if (!('Creator' in userInfo) || typeof userInfo.Creator !== 'string' || userInfo.Creator.trim().length === 0 || userInfo.Creator.length > 100) {
            res.status(400).json({ message: 'Creator in userInfo is required, must be a non-empty string, and not exceed 100 characters.' });
            return false;
        }
        // views
        if ('views' in userInfo) {
            if (isCreate) {// means if it is create request, views should not be provided by user
                res.status(400).json({ message: 'views cannot be set directly by the user.' });
                return false;
            }
            if (typeof userInfo.views !== 'number' || userInfo.views < 0 || !Number.isFinite(userInfo.views)) {
                res.status(400).json({ message: 'views in userInfo must be a non-negative number.' });
                return false;
            }
        }
    }
    return true;
}

const normalizePracticeInfoUrls = (practiceInfo, req) => { 
    if (!practiceInfo || typeof practiceInfo !== 'object') return practiceInfo;
    const normalized = { ...practiceInfo };
    if (practiceInfo.channelProfile) {
        normalized.channelProfile = makeImageUrl(practiceInfo.channelProfile, req);
    }
    if (practiceInfo.channelVideo) {
        normalized.channelVideo = makeMediaUrl(practiceInfo.channelVideo, req);
    }
    return normalized;
}// changes channelProfile and channelVideo urls in practiceInfo to http urls before sending response to client

const getAllpractices = async (req, res) => {
    // Return the most recent practiceOne document (by _id descending)
    const practices = await practice.find().lean();//get all practices from database
        if (!practices || practices.length === 0) return res.status(204).json({ 'message': 'No practices found.' }); //if no practices are found, return 204(empty).
       
        const mapped = practices.map(e => ({
            ...e,
            videoId: e.videoId || (e._id ? e._id.toString() : undefined),
            image: makeImageUrl(e.image, req),
            video: makeMediaUrl(e.video, req),
            practiceInfo: normalizePracticeInfoUrls(e.practiceInfo, req)
        }));
        res.json(mapped);
}

const createNewpractice = async (req, res) => {
    // For multipart/form-data, fields are in req.body, files in req.files
    if (!validateUserInput(req, res)) return;

    if (!req?.body?.name || !req?.body?.email || !req?.body?.job) {
        return res.status(400).json({ 'message': 'name, email and job are not provided' }); //400 means bad request
    }

    try {
        // Parse practiceInfo or userInfo if sent as JSON string or object
        let practiceInfo = undefined;
        if (req.body?.practiceInfo) {
            practiceInfo = typeof req.body.practiceInfo === 'string'
                ? JSON.parse(req.body.practiceInfo)
                : req.body.practiceInfo;
        } else if (req.body?.userInfo) {
            practiceInfo = typeof req.body.userInfo === 'string'
                ? JSON.parse(req.body.userInfo)
                : req.body.userInfo;
        }

        // Validate userInfo/practiceInfo fields
        if (practiceInfo && !validateUserInfo(practiceInfo, res, true)) return;

        let imagePath = req.body.image;
        let videoPath = req.body.video;
        if (req.files && req.files.image && req.files.image[0]) {
            imagePath = req.files.image[0].path; // Cloudinary URL
        }
        if (req.files && req.files.video && req.files.video[0]) {
            videoPath = req.files.video[0].path; // Cloudinary URL
        }

        const result = await practice.create({
            videoId: crypto.randomUUID(),
            name: req.body.name,
            email: req.body.email,
            job: req.body.job,
            image: imagePath,
            video: videoPath,
            ...(practiceInfo && { practiceInfo }),
            createdBy: req.practice // set creator from verifyJWT middleware
        });

        res.status(201).json(result);// 201 is success
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}

const updatepractice = async (req, res) => {
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }

    const foundpractice = await practice.findOne({ videoId }).exec();
    if (!foundpractice) {
        return res.status(204).json({ "message": `No practice matches videoId ${videoId}.` });
    }

    // Validate input fields
    if (!validateUserInput(req, res)) return;

    // Validate userInfo/practiceInfo if present
    let userInfo = req.body.userInfo || req.body.practiceInfo;
    if (userInfo) {
        try {
            if (typeof userInfo === 'string') userInfo = JSON.parse(userInfo);
        } catch (e) {
            res.status(400).json({ message: 'userInfo/practiceInfo must be a valid object or JSON string.' });
            return;
        }
        if (!validateUserInfo(userInfo, res, false)) return;
    }

    if (req.body?.name) foundpractice.name = req.body.name; // means replace the old one with the new
    if (req.body?.email) foundpractice.email = req.body.email;
    if (req.body?.job) foundpractice.job = req.body.job;

    // Update channelName, views, Creator, etc. inside practiceInfo Map if provided
    if (req.body?.channelName) {
        if (!foundpractice.practiceInfo) {
            foundpractice.practiceInfo = new Map();
        }
        foundpractice.practiceInfo.set('channelName', req.body.channelName);
    }
    if (req.body?.views !== undefined) {
        if (!foundpractice.practiceInfo) {
            foundpractice.practiceInfo = new Map();
        }
        foundpractice.practiceInfo.set('views', req.body.views);
    }
    if (req.body?.Creator) {
        if (!foundpractice.practiceInfo) {
            foundpractice.practiceInfo = new Map();
        }
        foundpractice.practiceInfo.set('Creator', req.body.Creator);
    }
    if (req.body?.channelProfile) {
        if (!foundpractice.practiceInfo) {
            foundpractice.practiceInfo = new Map();
        }
        foundpractice.practiceInfo.set('channelProfile', req.body.channelProfile);
    }
    if (req.body?.channelVideo) {
        if (!foundpractice.practiceInfo) {
            foundpractice.practiceInfo = new Map();
        }
        foundpractice.practiceInfo.set('channelVideo', req.body.channelVideo);
    }
    if (req.files && req.files.channelProfile && req.files.channelProfile[0]) {
        if (!foundpractice.practiceInfo) {
            foundpractice.practiceInfo = new Map();
        }
        foundpractice.practiceInfo.set('channelProfile', req.files.channelProfile[0].path); // Cloudinary URL
    }
    if (req.files && req.files.channelVideo && req.files.channelVideo[0]) {
        if (!foundpractice.practiceInfo) {
            foundpractice.practiceInfo = new Map();
        }
        foundpractice.practiceInfo.set('channelVideo', req.files.channelVideo[0].path); // Cloudinary URL
    }

    if (req.files && req.files.image && req.files.image[0]) {
        foundpractice.image = req.files.image[0].path; // Cloudinary URL
    }
    if (req.files && req.files.video && req.files.video[0]) {
        foundpractice.video = req.files.video[0].path; // Cloudinary URL
    }

    const result = await foundpractice.save();
    res.json(result);
}

const deletepractice = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const foundpractice = await practice.findOne({ videoId }).exec();
    if (!foundpractice) {
        return res.status(204).json({ "message": `No practice matches videoId ${videoId}.` });
    }

    if (foundpractice.image) {
            const imgPath = foundpractice.image.startsWith('images/') ? foundpractice.image : '';
            if (imgPath) {
                const fullImgPath = require('path').join(__dirname, '../public', imgPath);
                if (fs.existsSync(fullImgPath)) {
                    try { fs.unlinkSync(fullImgPath); } catch (e) { /* ignore */ }
                }
            }
        }
        // Delete video file if exists
        if (foundpractice.video) {
            const vidPath = foundpractice.video.startsWith('videos/') ? foundpractice.video : '';
            if (vidPath) {
                const fullVidPath = require('path').join(__dirname, '..', vidPath);
                if (fs.existsSync(fullVidPath)) {
                    try { fs.unlinkSync(fullVidPath); } catch (e) { /* ignore */ }
                }
            }
        }

    const result = await foundpractice.deleteOne(); //{ _id: req.body.id }
    res.json(result);
}


const getpractice = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const foundpractice = await practice.findOne({ videoId }).lean();
    if (!foundpractice) {
        return res.status(204).json({ "message": `No practice matches videoId ${videoId}.` });
    }

    foundpractice.image = makeImageUrl(foundpractice.image, req);// change the url to http...
    foundpractice.video = makeMediaUrl(foundpractice.video, req);
    foundpractice.practiceInfo = normalizePracticeInfoUrls(foundpractice.practiceInfo, req);
    res.json(foundpractice);
}

module.exports = {
    getAllpractices,
    createNewpractice,
    updatepractice,
    deletepractice,
    getpractice,
}

// Export the middleware for use in your routes
