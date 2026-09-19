import express from "express";
import multer from "multer";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import Activity from "../models/Activity.js";
import { mediaStorage } from "../config/cloudinary.js";

const activityRouter = express.Router();

// Multer setup for audio/video uploads
const upload = multer({
  storage: mediaStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Browsers produce a long tail of container types (audio/webm from
    // MediaRecorder, audio/x-m4a from iOS, video/quicktime from Safari), so
    // match on the media class instead of an allow-list that keeps going stale.
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio and video files are allowed.'));
    }
  }
});

// Get activities for a student
activityRouter.get("/student/:studentId", authorization, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type } = req.query; // Filter by type if provided

    const filter = { studentId };
    if (type) {
      filter.type = type;
    }

    const activities = await Activity.find(filter)
      .populate("teacherId", "name email")
      .sort({ date: -1 });

    sendResponse(res, 200, { activities }, false, "Activities fetched successfully");
  } catch (error) {
    console.error("Error fetching activities:", error);
    sendResponse(res, 500, null, true, "Error fetching activities: " + error.message);
  }
});

// Upload student practice (audio/video)
activityRouter.post("/upload", authorization, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return sendResponse(res, 400, null, true, "No file uploaded");
    }

    const { studentId, note } = req.body;

    if (!studentId) {
      return sendResponse(res, 400, null, true, "Student ID is required");
    }

    // Determine media type from mimetype
    const mediaType = req.file.mimetype.startsWith("video/") ? "video" : "audio";

    const activity = await Activity.create({
      studentId,
      type: "submission",
      content: note || `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} practice submission`,
      media: {
        type: mediaType,
        url: req.file.path,
        cloudinaryId: req.file.filename,
      },
      status: "pending",
    });

    const populatedActivity = await Activity.findById(activity._id);

    sendResponse(res, 201, { activity: populatedActivity }, false, "Practice uploaded successfully");
  } catch (error) {
    console.error("Error uploading practice:", error);
    sendResponse(res, 500, null, true, "Error uploading practice: " + error.message);
  }
});

// Add teacher remark
activityRouter.post("/teacher-remark", authorization, async (req, res) => {
  try {
    const { studentId, remarks } = req.body;

    if (!studentId || !remarks) {
      return sendResponse(res, 400, null, true, "Student ID and remarks are required");
    }

    const activity = await Activity.create({
      studentId,
      type: "remark",
      content: remarks,
      teacherName: req.user.name,
      teacherId: req.user._id,
      status: "reviewed",
    });

    sendResponse(res, 201, { activity }, false, "Remark added successfully");
  } catch (error) {
    console.error("Error adding remark:", error);
    sendResponse(res, 500, null, true, "Error adding remark: " + error.message);
  }
});

// Add teacher feedback to a submission
activityRouter.put("/:activityId/feedback", authorization, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return sendResponse(res, 400, null, true, "Feedback is required");
    }

    const activity = await Activity.findByIdAndUpdate(
      activityId,
      {
        teacherFeedback: feedback,
        teacherName: req.user.name,
        teacherId: req.user._id,
        status: "reviewed",
      },
      { new: true }
    );

    if (!activity) {
      return sendResponse(res, 404, null, true, "Activity not found");
    }

    // Also create a feedback activity
    await Activity.create({
      studentId: activity.studentId,
      type: "feedback",
      content: `Feedback on your submission`,
      teacherFeedback: feedback,
      teacherName: req.user.name,
      teacherId: req.user._id,
      status: "reviewed",
    });

    sendResponse(res, 200, { activity }, false, "Feedback added successfully");
  } catch (error) {
    console.error("Error adding feedback:", error);
    sendResponse(res, 500, null, true, "Error adding feedback: " + error.message);
  }
});

export default activityRouter;
