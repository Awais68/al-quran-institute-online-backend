import express from "express";
import multer from "multer";
import cloudinary from "../cloudnary.js";
import register from "../models/user.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Example: Express route handler
router.post("/signup", async (req, res) => {
  const { name, email, image, ...rest } = req.body;

  // image yahan ek string URL hai
  // Aap isay database mein save kar sakte hain
  const user = new newUser({
    name,
    email,
    image, // yeh Cloudinary ka URL hai
    ...rest,
  });

  await user.save();
  res.status(201).json({ message: "User created", user });
});

// POST /upload/:id
router.post("/:id", upload.single("image"), async (req, res) => {
  try {
    const userId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      { resource_type: "image" },
      async (error, result) => {
        if (error)
          return res
            .status(500)
            .json({ message: "Cloudinary upload failed", error });
        // Update user image field
        const user = await register.findByIdAndUpdate(
          userId,
          { image: result.secure_url },
          { new: true }
        );
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({
          message: "Image uploaded and user updated",
          imageUrl: result.secure_url,
          user,
        });
      }
    );
    result.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
