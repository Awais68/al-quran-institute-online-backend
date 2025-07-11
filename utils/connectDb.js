import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import Image from "../models/Image.js";
import { storage } from "../config/cloudinary.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const connectToDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log("DB is already connected.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("DataBase is Connected.");
  } catch (err) {
    console.log("Failed to connect DB", err.message);
  }
};

// Multer setup
const upload = multer({ storage });

// Upload route
app.post("/api/upload", upload.single("image"), async (req, res) => {
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
app.get("/api/images", async (req, res) => {
  try {
    const images = await Image.find();
    res.status(200).json(images);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching images", error: error.message });
  }
});

export default connectToDB;
