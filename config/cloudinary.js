import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

if (!process.env.CLOUD_NAME || !process.env.API_KEY || !process.env.API_SECRET) {
  // Fail loudly at boot instead of returning an opaque 500 on every upload.
  console.error(
    "[cloudinary] Missing CLOUD_NAME / API_KEY / API_SECRET - image uploads will fail."
  );
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Uploads",
    allowed_formats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

// Practice submissions are audio/video, which the image-only `storage` above
// rejects (default resource_type is "image" and allowed_formats is image-only).
// Cloudinary handles audio under the "video" resource type, so "auto" covers both.
const mediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: "Practice",
    resource_type: "auto",
  }),
});

export { cloudinary, storage, mediaStorage };
