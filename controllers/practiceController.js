
const user = require('../model/modelpracticeOne.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { practiceSanitization, handleValidationErrors } = require('../middleware/sanitization');




function validateUserInput(req, res) {
    // Only validate fields that are present in the request body
    if ('views' in req.body) {// means if there is views in the request body, reject it because views should not be set by user
        res.status(400).json({ message: 'views cannot be set or updated by the user.' });
        return false;
    }
    if ('name' in req.body) {
        if (typeof req.body.name !== 'string' || req.body.name.length > 50) {
            res.status(400).json({ message: 'Name must be a string and not exceed 50 characters.' });
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
        if (typeof req.body.job !== 'string' || req.body.job.length > 100) {
            res.status(400).json({ message: 'Job must be a string and not exceed 100 characters.' });
            return false;
        }
    }
    return true;
}

// Reusable input validation function for userInfo
function validateUserInfo(userInfo, res, isCreate = false) {
    if (typeof userInfo === 'string') {// IF userinfo is string
        res.status(400).json({ message: 'userInfo must not be a string.' });
        return false;
    }
    if (Array.isArray(userInfo)) {// if userinfo is an array
        res.status(400).json({ message: 'userInfo must not be an array.' });
        return false;
    }
    if (typeof userInfo === 'object' && userInfo !== null) {// if userinfo is an object but not empty
        // Check channelName
        if ('channelName' in userInfo) {
            if (typeof userInfo.channelName !== 'string' || userInfo.channelName.length > 100) {
                res.status(400).json({ message: 'channelName in userInfo must be a string and not exceed 100 characters.' });
                return false;
            }
        }
        // Check creator
        if ('Creator' in userInfo) {
            if (typeof userInfo.Creator !== 'string' || userInfo.Creator.length > 100) {
                res.status(400).json({ message: 'Creator in userInfo must be a string and not exceed 100 characters.' });
                return false;
            }
        }
        // Check views
        if ('views' in userInfo) {
            if (isCreate) {// means if it is create request, views should not be set by user
                res.status(400).json({ message: 'views cannot be set directly by the user.' });
                return false;
            }
            if (typeof userInfo.views !== 'number' || userInfo.views < 0 || !Number.isFinite(userInfo.views)) {// !Number.isFinite(userInfo.views) means views should be a finite number, not Infinity or NaN
                res.status(400).json({ message: 'views in userInfo must be a non-negative number.' });
                return false;
            }
        }
    }
    return true;
}

const getAllusers = async (req, res) => {
    // Return the most recent practiceOne document (by _id descending)
    const latestUser = await user.findOne().sort({ _id: -1 }).lean();
    if (!latestUser) return res.status(204).json({ 'message': 'No user found.' });
    res.json(latestUser);
}





const createNewuser = async (req, res) => {
    // For multipart/form-data, fields are in req.body, files in req.files
    validateUserInput(req, res); // Call the function as requested
    if (!req?.body?.name || !req?.body?.email || !req?.body?.job) {
        return res.status(400).json({ 'message': 'name, email and job are not provided' }); //400 means bad request
    }
    // Validate field lengths and formats
    if (typeof req.body.name !== 'string' || req.body.name.length > 50) {
        return res.status(400).json({ message: 'Name must be a string and not exceed 50 characters.' });
    }
    if (typeof req.body.email !== 'string' || !/^\S+@gmail\.com$/.test(req.body.email)) {
        return res.status(400).json({ message: 'Email must be a valid gmail.com address.' });
    }
    if (typeof req.body.job !== 'string' || req.body.job.length > 100) {
        return res.status(400).json({ message: 'Job must be a string and not exceed 100 characters.' });
    }

    // Validate userInfo if present
    let userInfo = req.body?.userInfo ? req.body.userInfo : undefined;
    if (userInfo !== undefined) {
        if (!validateUserInfo(userInfo, res, true)) return;
    }

    try {
        // Parse userInfo if sent as JSON string
        // (already handled above)

        const result = await user.create({
            videoId: crypto.randomUUID(),
            name: req.body.name,
            email: req.body.email,
            job: req.body.job,
            ...(userInfo && { userInfo }),
            createdBy: req.user // set creator from verifyJWT middleware
        });

        res.status(201).json(result);// 201 is success
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}

const updateuser = async (req, res) => {
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }

    if (!validateUserInput(req, res)) return;

    // Validate userInfo if present
    let userInfo = req.body?.userInfo ? req.body.userInfo : undefined;
    if (userInfo !== undefined) {
        if (!validateUserInfo(userInfo, res, false)) return;
    }

    const foundUser = await user.findOne({ videoId }).exec(); //gets user related with the above videoId from the db
    if (!foundUser) {
        return res.status(204).json({ "message": `No user matches videoId ${videoId}.` });
    }

    if (req.body?.name) foundUser.name = req.body.name;
    if (req.body?.email) foundUser.email = req.body.email;
    if (req.body?.job) foundUser.job = req.body.job;

    // Helper for sanitizing strings
    function sanitizeString(str) {
        return typeof str === 'string'
            ? str.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;' }[s]))
            : str;
    }

    // Update channelName inside userInfo Map if provided, with sanitization
    if (req.body?.channelName) {
        if (!foundUser.userInfo) {
            foundUser.userInfo = new Map();
        }
        foundUser.userInfo.set('channelName', sanitizeString(req.body.channelName));
    }
    if (req.body?.views) {
        if (!foundUser.userInfo) {
            foundUser.userInfo = new Map();
        }
        foundUser.userInfo.set('views', req.body.views);
    }
    if (req.body?.Creator) {
        if (!foundUser.userInfo) {
            foundUser.userInfo = new Map();
        }
        foundUser.userInfo.set('Creator', sanitizeString(req.body.Creator));
    }

    // Optionally update other userInfo fields if provided as an object
    if (req.body?.userInfo && typeof req.body.userInfo === 'object') {
        if (!foundUser.userInfo) {
            foundUser.userInfo = new Map();
        }
        for (const [key, value] of Object.entries(req.body.userInfo)) {
            foundUser.userInfo.set(key, typeof value === 'string' ? sanitizeString(value) : value);
        }
    }

    // Optionally update other userInfo fields if provided as an object
    // if (req.body?.userInfo && typeof req.body.userInfo === 'object') {
    //     if (!foundUser.userInfo) {
    //         foundUser.userInfo = new Map();
    //     }
    //     for (const [key, value] of Object.entries(req.body.userInfo)) {
    //         foundUser.userInfo.set(key, value);
    //     }
    // }

    const result = await foundUser.save();
    res.json(result);
}

const deleteuser = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const foundUser = await user.findOne({ videoId }).exec();
    if (!foundUser) {
        return res.status(204).json({ "message": `No user matches videoId ${videoId}.` });
    }

    const result = await foundUser.deleteOne();
    res.json(result);
}

const getuser = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const foundUser = await user.findOne({ videoId }).lean();
    if (!foundUser) {
        return res.status(204).json({ "message": `No user matches videoId ${videoId}.` });
    }
    res.json(foundUser);
}

module.exports = {
    getAllusers,
    createNewuser,
    updateuser,
    deleteuser,
    getuser,
    practiceSanitization,
    handleValidationErrors
}