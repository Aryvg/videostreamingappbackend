const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    roles: {
        User: {
            type: Number,
            default: 2001 // means everyone will have this as a default
        },
        Editor: Number,
        Admin: Number
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false
    },
    firstname: {
        type: String,
        required: false
    },
    lastname: {
        type: String,
        required: false
    },
    profilePhoto: {
        type: String,
        required: false
    },
    age: {
        type: Number,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: String,
    verificationExpires: {
        type: Date,
        index: { expires: 0 }
    },
    pendingDeleteAt: {
        type: Date,
        index: { expires: 0 }
    },
    resetPasswordCode: String,
    resetPasswordExpires: Date,
    refreshToken: String
});

module.exports = mongoose.model('User', userSchema);
//Th model folder we use