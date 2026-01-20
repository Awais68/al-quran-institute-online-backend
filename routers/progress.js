import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import Progress from "../models/Progress.js";
import Joi from "joi";

const progressRouter = express.Router();

// Get student progress
progressRouter.get("/student/:studentId", authorization, async (req, res) => {
  try {
    const { studentId } = req.params;

    let progress = await Progress.findOne({ studentId });

    // Create default progress if not exists
    if (!progress) {
      progress = await Progress.create({ studentId });
    }

    sendResponse(res, 200, { progress }, false, "Progress fetched successfully");
  } catch (error) {
    console.error("Error fetching progress:", error);
    sendResponse(res, 500, null, true, "Error fetching progress: " + error.message);
  }
});

// Add teacher feedback (Teacher only)
progressRouter.post("/feedback", authorization, async (req, res) => {
  try {
    const { studentId, remarks, rating, improvements } = req.body;

    if (!studentId || !remarks || !rating) {
      return sendResponse(res, 400, null, true, "Student ID, remarks, and rating are required");
    }

    if (rating < 1 || rating > 5) {
      return sendResponse(res, 400, null, true, "Rating must be between 1 and 5");
    }

    let progress = await Progress.findOne({ studentId });

    if (!progress) {
      progress = await Progress.create({ studentId });
    }

    // Add feedback
    progress.teacherFeedback.push({
      date: new Date(),
      remarks,
      rating,
      improvements: improvements || [],
      teacherName: req.user.name,
      teacherId: req.user._id,
    });

    await progress.save();

    sendResponse(res, 200, { progress }, false, "Feedback added successfully");
  } catch (error) {
    console.error("Error adding feedback:", error);
    sendResponse(res, 500, null, true, "Error adding feedback: " + error.message);
  }
});

// Update progress percentages (Teacher only)
progressRouter.put("/update/:studentId", authorization, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { overall, attendance, recitation, memorization, tajweed } = req.body;

    let progress = await Progress.findOne({ studentId });

    if (!progress) {
      progress = await Progress.create({ studentId });
    }

    // Update fields if provided
    if (overall !== undefined) progress.overall = overall;
    if (attendance !== undefined) progress.attendance = attendance;
    if (recitation !== undefined) progress.recitation = recitation;
    if (memorization !== undefined) progress.memorization = memorization;
    if (tajweed !== undefined) progress.tajweed = tajweed;

    // Calculate overall if not provided
    if (overall === undefined) {
      progress.overall = Math.round(
        (progress.attendance + progress.recitation + progress.memorization + progress.tajweed) / 4
      );
    }

    await progress.save();

    sendResponse(res, 200, { progress }, false, "Progress updated successfully");
  } catch (error) {
    console.error("Error updating progress:", error);
    sendResponse(res, 500, null, true, "Error updating progress: " + error.message);
  }
});

export default progressRouter;
