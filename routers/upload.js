import express from "express";
import multer from "multer";
import Image from "../models/Image.js";
import { storage } from "../config/cloudinary.js";

const uploadRouter = express.Router();

// Multer setup
const upload = multer({
  storage,
  // Keep in sync with MAX_IMAGE_BYTES in the frontend's signup/account page.
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Upload route.
// The router is mounted at "/upload" in index.js, so the handler path must be
// "/" — the clients POST to BASE_URL + "/upload". "/upload" is kept as an alias
// for older clients that hit the previous "/upload/upload" path.
uploadRouter.post(["/", "/upload"], upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image received. Send the file as the "image" field.',
      });
    }

    const { name } = req.body;
    const image = {
      name: name || req.file.originalname,
      url: req.file.path,
      publicId: req.file.filename,
    };

    const savedImage = await Image.create(image);
    res
      .status(200)
      .json({ message: "Image uploaded successfully", data: savedImage });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Image upload failed", error: error.message });
  }
});

// Retrieve images
uploadRouter.get("/images", async (req, res) => {
  try {
    const images = await Image.find();
    res.status(200).json(images);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching images", error: error.message });
  }
});

// Multer error handling (file too large, invalid format, etc.)
uploadRouter.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image is too large. Maximum size is 2MB."
        : err.message;
    // Multer aborts mid-upload, so the client may still be streaming the body.
    // Drain it before answering, otherwise Node resets the socket and the
    // browser reports a generic network error instead of this message.
    req.unpipe();
    req.resume();
    return res.status(400).json({ success: false, message });
  }
  if (err && err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

export default uploadRouter;