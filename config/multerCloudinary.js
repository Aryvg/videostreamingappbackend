// backend/config/multerCloudinary.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');
const crypto = require('crypto');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'uploads';
    if (file.mimetype.startsWith('image/')) folder = 'images';
    if (file.mimetype.startsWith('video/')) folder = 'videos';
    const baseName = file.originalname.split('.')[0];
    return {
      folder: folder,
      resource_type: 'auto',
      public_id: `${baseName}-${crypto.randomUUID()}`,
    };
  },
});

const upload = multer({ storage });

const uploadMainPage = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'thumbnail') {
      return cb(null, true);
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    const originalName = (file.originalname || '').toLowerCase();
    const isAllowedExtension = /\.(jpg|jpeg|png)$/i.test(originalName);

    if (allowedMimeTypes.includes(file.mimetype) && isAllowedExtension) {
      return cb(null, true);
    }

    const error = new Error('Thumbnail must be a JPG, JPEG, or PNG image.');
    error.statusCode = 400;
    return cb(error);
  }
});

module.exports = upload;
module.exports.uploadMainPage = uploadMainPage;

