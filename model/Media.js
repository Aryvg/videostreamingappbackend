const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mediaSchema = new Schema({
  filename: { type: String, required: true, unique: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true }
});

module.exports = mongoose.model('Media', mediaSchema);
