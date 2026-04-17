import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import Lesson from "../models/Lesson.js";
import RecitationPractice from "../models/RecitationPractice.js";
import Joi from "joi";

const lessonRouter = express.Router();

// Validation schema
const lessonSchema = Joi.object({
  studentId: Joi.string().required(),
  courseId: Joi.string().required(),
  title: Joi.string().required(),
  date: Joi.date().required(),
  time: Joi.string().required(),
  rules: Joi.string().allow(""),
  teacherNotes: Joi.string().allow(""),
  repeat: Joi.boolean().optional(),
});

// Get lessons for a student
lessonRouter.get("/student/:studentId", authorization, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type } = req.query; // 'upcoming' or 'completed'

    const filter = { studentId };
    if (type) {
      filter.type = type;
    }

    const lessons = await Lesson.find(filter)
      .populate("teacherId", "name email")
      .sort({ date: 1, time: 1 });

    sendResponse(res, 200, { lessons }, false, "Lessons fetched successfully");
  } catch (error) {
    console.error("Error fetching lessons:", error);
    sendResponse(res, 500, null, true, "Error fetching lessons: " + error.message);
  }
});

// Add a new lesson (Teacher only)
lessonRouter.post("/add", authorization, async (req, res) => {
  try {
    const { error } = lessonSchema.validate(req.body);
    if (error) {
      return sendResponse(res, 400, null, true, error.details[0].message);
    }

    const { studentId, courseId, title, date, time, rules, teacherNotes, repeat } = req.body;
    
    const lesson = await Lesson.create({
      studentId,
      teacherId: req.user._id,
      courseId,
      title,
      date,
      time,
      rules,
      teacherNotes,
      repeated: repeat || false,
    });

    const populatedLesson = await Lesson.findById(lesson._id)
      .populate("teacherId", "name email")
      .populate("studentId", "name email");

    sendResponse(res, 201, { lesson: populatedLesson }, false, "Lesson added successfully");
  } catch (error) {
    console.error("Error adding lesson:", error);
    sendResponse(res, 500, null, true, "Error adding lesson: " + error.message);
  }
});

// Mark lesson as completed
lessonRouter.put("/:lessonId/complete", authorization, async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await Lesson.findByIdAndUpdate(
      lessonId,
      { completed: true, type: "completed" },
      { new: true }
    ).populate("teacherId", "name email");

    if (!lesson) {
      return sendResponse(res, 404, null, true, "Lesson not found");
    }

    sendResponse(res, 200, { lesson }, false, "Lesson marked as completed");
  } catch (error) {
    console.error("Error completing lesson:", error);
    sendResponse(res, 500, null, true, "Error completing lesson: " + error.message);
  }
});

// Get recitation practice materials
lessonRouter.get("/recitation/:studentId", authorization, async (req, res) => {
  try {
    const { studentId } = req.params;

    const practices = await RecitationPractice.find({ studentId })
      .populate("teacherId", "name email")
      .sort({ addedAt: -1 });

    sendResponse(res, 200, { practices }, false, "Recitation practices fetched successfully");
  } catch (error) {
    console.error("Error fetching recitation practices:", error);
    sendResponse(res, 500, null, true, "Error fetching practices: " + error.message);
  }
});

// Add recitation practice material (Teacher only)
lessonRouter.post("/recitation/add", authorization, async (req, res) => {
  try {
    const { studentId, title, type, url, cloudinaryId } = req.body;

    if (!studentId || !title || !type || !url) {
      return sendResponse(res, 400, null, true, "Missing required fields");
    }

    const practice = await RecitationPractice.create({
      studentId,
      teacherId: req.user._id,
      title,
      type,
      url,
      cloudinaryId,
      addedBy: req.user.name,
    });

    sendResponse(res, 201, { practice }, false, "Practice material added successfully");
  } catch (error) {
    console.error("Error adding practice material:", error);
    sendResponse(res, 500, null, true, "Error adding practice: " + error.message);
  }
});

export default lessonRouter;
