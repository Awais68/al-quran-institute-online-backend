import express from "express";
import multer from "multer";
import cloudnary from "../cloudnary.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// POST /upload
router.post("/", upload.single("image"), (req, res) => {
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const result = await cloudnary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "al-quran", // optional
      },
      (error, result) => {
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ url: result?.secure_url });
      }
    );

    result.end(req.file.buffer); // pipe file buffer into cloudinary stream
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/upload", upload.single("image"), (req, res) => {
  // User profile image update logic
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

export default router;
