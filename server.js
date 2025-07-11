// import express from "express";
// import mongoose from "mongoose";
// import multer from "multer";
// import { storage } from "./config/cloudinary.js";
// import Image from "./models/Image.js";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // MongoDB connection
// mongoose
//   .connect(process.env.MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("MongoDB connected"))
//   .catch((err) => console.log(err));

// // Multer setup
// const upload = multer({ storage });

// // Upload route
// app.post("/api/upload", upload.single("image"), async (req, res) => {
//   try {
//     const { name } = req.body;
//     const image = {
//       name: name || req.file.originalname,
//       url: req.file.path,
//       publicId: req.file.filename,
//     };

//     const savedImage = await Image.create(image);
//     res
//       .status(200)
//       .json({ message: "Image uploaded successfully", data: savedImage });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Image upload failed", error: error.message });
//   }
// });

// // Retrieve images
// app.get("/api/images", async (req, res) => {
//   try {
//     const images = await Image.find();
//     res.status(200).json(images);
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error fetching images", error: error.message });
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
