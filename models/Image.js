import mongoose from "mongoose";
const imageSchema = new mongoose.Schema({
  name: String,
  url: String,
  publicId: String,
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Image", imageSchema);
