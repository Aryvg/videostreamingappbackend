const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const practiceOneSchema = new Schema({
    videoId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    job: {
        type: String,
        required: true
    },
    createdBy: {
        type: String,
        required: false
    },
    userInfo: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {
            channelName: 'Video-editing',
            views: 20,
            creator: 'Programming'
        }
    }
});

module.exports = mongoose.model('user', practiceOneSchema);

