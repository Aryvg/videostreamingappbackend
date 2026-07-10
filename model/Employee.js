const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const employeeSchema = new Schema({
    videoId: {
        type: String,
        required: true,
        unique: true
    },
    firstname: {
        type: String,// means it must be text
        required: true// required:true means it must exist and it must not be empty
    },
    lastname: {
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
        required: false// means sending video is optional
    },
    createdBy: {
        type: String,
        required: false
    },
    // comments: {
    //     type: Map,
    //     of: String,
    //     // default: {
    //     //     comment1: 'This is the first comment',
    //     //     comment2: 'This is the second comment',
    //     //     comment3: 'Nice post!'
    //     // }
    //     comments: {
    //         type: [String],
    //         default: []
    //     }
    // },
    comments: {
        type: [String],
        default: []
    },
    skills: {
        type: Map,
        of: String,//If you want it to be a combination of number and string, you would say of:mongoose.Schema.Types.Mixed
        default: {
            skill1: 'Video-editing',
            skill2: 'Graphic design',
            skill3: 'Programming'
        }
    }
});

module.exports = mongoose.model('Employee', employeeSchema);