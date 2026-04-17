import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Image name is required'],
    trim: true,
    maxlength: [200, 'Image name cannot exceed 200 characters']
  },
  url: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true,
    match: [/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i, 'Please enter a valid image URL']
  },
  publicId: {
    type: String,
    required: [true, 'Public ID is required'],
    trim: true,
    unique: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
}, {
  timestamps: true // Add createdAt and updatedAt
});

// Add indexes for frequently queried fields
imageSchema.index({ publicId: 1 });
imageSchema.index({ uploadedAt: -1 });

const Image = mongoose.model("Image", imageSchema);
export default Image;
