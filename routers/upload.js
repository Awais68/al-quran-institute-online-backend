import express from "express";
import multer from "multer";
import Image from "../models/Image.js";
import { storage } from "../config/cloudinary.js";

const uploadRouter = express.Router();

// Multer setup
const upload = multer({ storage });

// Upload route
uploadRouter.post("/upload", upload.single("image"), async (req, res) => {
  try {
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

export default uploadRouter;