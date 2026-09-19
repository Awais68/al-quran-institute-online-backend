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

export { cloudinary, storage };
