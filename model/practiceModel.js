const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const practiceOneSchema = new Schema({
    videoId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,// means it must be text
        required: true// required:true means it must exist and it must not be empty
    },
    email: {
        type: String,
        required: true
    },
    job: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
   
    
    video: {
        type: String, //say type:Number if it is number
        required: true// means sending video is optional
    }
    ,
    createdBy: {
        type: String,
        required: false
    }
    ,

    practiceInfo: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {
            channelName: 'Video-editing',
            views: 20,
            creator: 'Programming',
            channelProfile:'',
            channelVideo:''
        }
    }
});

module.exports = mongoose.model('practice', practiceOneSchema);

