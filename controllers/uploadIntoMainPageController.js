const UploadIntoMainPage = require('../model/UploadIntoMainPage');
const crypto = require('crypto');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const { uploadIntoMainPageSanitization, handleValidationErrors } = require('../middleware/sanitization');

function validateTitle(title, res) {
    if (typeof title !== 'string' || title.trim().length < 1) {
        return res.status(400).json({ message: 'Title is required.' });
    }
    if (title.length > 150) {
        return res.status(400).json({ message: 'Title must not exceed 150 characters.' });
    }
    return title.trim();
}

function validateShortDescription(shortDescription, res) {
    if (typeof shortDescription !== 'string' || shortDescription.trim().length < 1) {
        return res.status(400).json({ message: 'Short description is required.' });
    }
    if (shortDescription.length > 300) {
        return res.status(400).json({ message: 'Short description must not exceed 300 characters.' });
    }
    return shortDescription.trim();
}

function validateFullDescription(fullDescription, res) {
    if (typeof fullDescription !== 'string' || fullDescription.trim().length < 1) {
        return res.status(400).json({ message: 'Full description is required.' });
    }
    if (fullDescription.length > 5000) {
        return res.status(400).json({ message: 'Full description must not exceed 5000 characters.' });
    }
    return fullDescription.trim();
}

const makeImageUrl = (imgPath, req) => {
    if (!imgPath) return '';
    if (typeof imgPath !== 'string') return '';
    const trimmed = imgPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    const clean = trimmed.replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${clean}`;
}

const makeMediaUrl = (mediaPath, req) => {
    if (!mediaPath) return '';
    if (typeof mediaPath !== 'string') return '';
    const trimmed = mediaPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    const base = path.basename(trimmed);
    return `${req.protocol}://${req.get('host')}/media/file/${encodeURIComponent(base)}`;
}

const getAllUploadIntoMainPage = async (req, res) => {
    const uploads = await UploadIntoMainPage.find().lean();
    if (!uploads || uploads.length === 0) return res.status(204).json({ message: 'No uploads found.' });

    const mapped = uploads.map(upload => ({
        ...upload,
        thumbnail: makeImageUrl(upload.thumbnail, req),
        videoFile: makeMediaUrl(upload.videoFile, req)
    }));
    res.json(mapped);
}

const createNewUploadIntoMainPage = async (req, res) => {
    if (!req?.body?.title || !req?.body?.shortDescription || !req?.body?.fullDescription) {
        return res.status(400).json({ message: 'Title, short description, and full description are required.' });
    }

    const checkedTitle = validateTitle(req.body.title, res);
    if (!checkedTitle) return;

    const checkedShortDescription = validateShortDescription(req.body.shortDescription, res);
    if (!checkedShortDescription) return;

    const checkedFullDescription = validateFullDescription(req.body.fullDescription, res);
    if (!checkedFullDescription) return;

    try {
        let thumbnailPath = req.body.thumbnail;
        let videoPath = req.body.videoFile;

        if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
            thumbnailPath = req.files.thumbnail[0].path;
        }
        if (req.files && req.files.videoFile && req.files.videoFile[0]) {
            videoPath = req.files.videoFile[0].path;
        }

        const result = await UploadIntoMainPage.create({
            itemId: crypto.randomUUID(),
            title: checkedTitle,
            shortDescription: checkedShortDescription,
            fullDescription: checkedFullDescription,
            thumbnail: thumbnailPath,
            videoFile: videoPath,
            createdBy: req.user || undefined
        });

        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}

const updateUploadIntoMainPage = async (req, res) => {
    const itemId = req.body?.itemId || req.query?.itemId || req.params?.itemId;
    if (!itemId) {
        return res.status(400).json({ message: 'itemId parameter is required.' });
    }

    const upload = await UploadIntoMainPage.findOne({ itemId }).exec();
    if (!upload) {
        return res.status(204).json({ message: `No upload matches itemId ${itemId}.` });
    }

    if (req.body?.title) {
        const checkedTitle = validateTitle(req.body.title, res);
        if (!checkedTitle) return;
        upload.title = checkedTitle;
    }

    if (req.body?.shortDescription) {
        const checkedShortDescription = validateShortDescription(req.body.shortDescription, res);
        if (!checkedShortDescription) return;
        upload.shortDescription = checkedShortDescription;
    }

    if (req.body?.fullDescription) {
        const checkedFullDescription = validateFullDescription(req.body.fullDescription, res);
        if (!checkedFullDescription) return;
        upload.fullDescription = checkedFullDescription;
    }

    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
        if (upload.thumbnail) {
            const oldId = upload.thumbnail.match(/\/v\d+\/(.+?)\.\w+$/)?.[1];
            if (oldId) await cloudinary.uploader.destroy(oldId).catch(() => {});
        }
        upload.thumbnail = req.files.thumbnail[0].path;
    }
    if (req.files && req.files.videoFile && req.files.videoFile[0]) {
        if (upload.videoFile) {
            const oldId = upload.videoFile.match(/\/v\d+\/(.+?)\.\w+$/)?.[1];
            if (oldId) await cloudinary.uploader.destroy(oldId, { resource_type: 'video' }).catch(() => {});
        }
        upload.videoFile = req.files.videoFile[0].path;
    }

    const result = await upload.save();
    res.json(result);
}

const deleteUploadIntoMainPage = async (req, res) => {
    const itemId = req.body?.itemId || req.query?.itemId || req.params?.itemId;
    if (!itemId) return res.status(400).json({ message: 'itemId required.' });

    const upload = await UploadIntoMainPage.findOne({ itemId }).exec();
    if (!upload) {
        return res.status(204).json({ message: `No upload matches itemId ${itemId}.` });
    }

    // This regex finds the public_id (folder/filename) from a Cloudinary URL
    // It looks for: /v[numbers]/ then captures everything until the file extension
    const extractPublicId = (url) => {
        // Use regex to match and capture the part after version number and before file extension
        // Example: "https://res.cloudinary.com/x/image/upload/v123/images/photo.jpg" → "images/photo"
        const match = url.match(/\/v\d+\/(.+?)\.\w+$/);
        // Return what we captured (the folder/filename), or null if the URL doesn't match
        return match ? match[1] : null;
    };

    try {
        // Delete thumbnail from Cloudinary
        if (upload.thumbnail) {
            const thumbPublicId = extractPublicId(upload.thumbnail);
            if (thumbPublicId) {
                console.log('Deleting thumbnail:', thumbPublicId);
                await cloudinary.uploader.destroy(thumbPublicId);
            }
        }

        // Delete video from Cloudinary
        if (upload.videoFile) {
            const videoPublicId = extractPublicId(upload.videoFile);
            if (videoPublicId) {
                console.log('Deleting video:', videoPublicId);
                await cloudinary.uploader.destroy(videoPublicId, { resource_type: 'video' });
            }
        }
    } catch (err) {
        console.error('Error deleting from Cloudinary:', err.message);
    }

    const result = await upload.deleteOne();
    res.json(result);
}

const getUploadIntoMainPage = async (req, res) => {
    const itemId = req.params?.itemId || req.query?.itemId || req.body?.itemId;
    if (!itemId) return res.status(400).json({ message: 'itemId required.' });

    const upload = await UploadIntoMainPage.findOne({ itemId }).lean();
    if (!upload) {
        return res.status(204).json({ message: `No upload matches itemId ${itemId}.` });
    }

    upload.thumbnail = makeImageUrl(upload.thumbnail, req);
    upload.videoFile = makeMediaUrl(upload.videoFile, req);
    res.json(upload);
}

module.exports = {
    getAllUploadIntoMainPage,
    createNewUploadIntoMainPage,
    updateUploadIntoMainPage,
    deleteUploadIntoMainPage,
    getUploadIntoMainPage,
    uploadIntoMainPageSanitization,
    handleValidationErrors
};
