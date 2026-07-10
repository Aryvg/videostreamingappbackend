const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const uploadIntoMainPageSchema = new Schema({
    itemId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        required: true
    },
    fullDescription: {
        type: String,
        required: true
    },
    thumbnail: {
        type: String,
        required: true
    },
    videoFile: {
        type: String,
        required: false
    },
    createdBy: {
        type: String,
        required: false
    }
});

module.exports = mongoose.model('UploadIntoMainPage', uploadIntoMainPageSchema);
