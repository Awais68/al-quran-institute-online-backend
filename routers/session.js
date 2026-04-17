import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import Session from "../models/Session.js";
import Notification from "../models/Notification.js";

const sessionRouter = express.Router();

// Get all sessions for current user (teacher or student)
sessionRouter.get("/", authorization, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const filter = {};
    
    // Filter based on user role
    if (req.user.role === "Teacher") {
      filter.teacherId = req.user._id;
    } else if (req.user.role === "Student") {
      filter.studentId = req.user._id;
    } else {
      return sendResponse(res, 403, null, true, "Access denied");
    }

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.scheduledDate = {};
      if (startDate) filter.scheduledDate.$gte = new Date(startDate);
      if (endDate) filter.scheduledDate.$lte = new Date(endDate);
    }

    const sessions = await Session.find(filter)
      .populate("teacherId", "name email image")
      .populate("studentId", "name email image course")
      .sort({ scheduledDate: 1 });

    sendResponse(res, 200, { sessions }, false, "Sessions fetched successfully");
  } catch (error) {
    console.error("Error fetching sessions:", error);
    sendResponse(res, 500, null, true, "Error fetching sessions: " + error.message);
  }
});

// Get single session by ID
sessionRouter.get("/:id", authorization, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate("teacherId", "name email image")
      .populate("studentId", "name email image course");

    if (!session) {
      return sendResponse(res, 404, null, true, "Session not found");
    }

    // Check authorization
    if (
      session.teacherId._id.toString() !== req.user._id.toString() &&
      session.studentId._id.toString() !== req.user._id.toString() &&
      req.user.role !== "Admin"
    ) {
      return sendResponse(res, 403, null, true, "Access denied");
    }

    sendResponse(res, 200, { session }, false, "Session fetched successfully");
  } catch (error) {
    console.error("Error fetching session:", error);
    sendResponse(res, 500, null, true, "Error fetching session: " + error.message);
  }
});

// Create new session (Teacher only)
sessionRouter.post("/", authorization, async (req, res) => {
  try {
    if (req.user.role !== "Teacher" && req.user.role !== "Admin") {
      return sendResponse(res, 403, null, true, "Only teachers can schedule sessions");
    }

    const { studentId, course, scheduledDate, duration, topic, notes } = req.body;

    if (!studentId || !course || !scheduledDate) {
      return sendResponse(res, 400, null, true, "Missing required fields");
    }

    const session = await Session.create({
      teacherId: req.user._id,
      studentId,
      course,
      scheduledDate: new Date(scheduledDate),
      duration: duration || 60,
      topic,
      notes,
      meetingLink: `/video-call/room-${studentId}`,
    });

    const populatedSession = await Session.findById(session._id)
      .populate("teacherId", "name email")
      .populate("studentId", "name email");

    // Create notification for student
    const notification = await Notification.create({
      userId: studentId,
      type: "session",
      title: "New Class Scheduled",
      message: `${req.user.name} has scheduled a ${course} class on ${new Date(scheduledDate).toLocaleDateString()} at ${new Date(scheduledDate).toLocaleTimeString()}`,
      relatedId: session._id,
      relatedModel: "Session",
      actionUrl: `/students?tab=schedule`,
    });

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(studentId.toString()).emit("new-notification", notification);
      io.to(studentId.toString()).emit("session-scheduled", populatedSession);
    }

    sendResponse(res, 201, { session: populatedSession }, false, "Session scheduled successfully");
  } catch (error) {
    console.error("Error creating session:", error);
    sendResponse(res, 500, null, true, "Error creating session: " + error.message);
  }
});

// Update session
sessionRouter.put("/:id", authorization, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return sendResponse(res, 404, null, true, "Session not found");
    }

    // Check authorization
    if (
      session.teacherId.toString() !== req.user._id.toString() &&
      req.user.role !== "Admin"
    ) {
      return sendResponse(res, 403, null, true, "Only the teacher who created this session can update it");
    }

    const { scheduledDate, duration, topic, notes, status, teacherNotes } = req.body;

    if (scheduledDate) session.scheduledDate = new Date(scheduledDate);
    if (duration) session.duration = duration;
    if (topic !== undefined) session.topic = topic;
    if (notes !== undefined) session.notes = notes;
    if (status) session.status = status;
    if (teacherNotes !== undefined) session.teacherNotes = teacherNotes;

    await session.save();

    const populatedSession = await Session.findById(session._id)
      .populate("teacherId", "name email")
      .populate("studentId", "name email");

    // Notify student of update
    if (scheduledDate || status === "cancelled") {
      await Notification.create({
        userId: session.studentId,
        type: "session",
        title: status === "cancelled" ? "Class Cancelled" : "Class Rescheduled",
        message: status === "cancelled" 
          ? `Your ${session.course} class has been cancelled`
          : `Your ${session.course} class has been rescheduled to ${new Date(scheduledDate).toLocaleDateString()} at ${new Date(scheduledDate).toLocaleTimeString()}`,
        relatedId: session._id,
        relatedModel: "Session",
        actionUrl: `/students?tab=schedule`,
      });
    }

    sendResponse(res, 200, { session: populatedSession }, false, "Session updated successfully");
  } catch (error) {
    console.error("Error updating session:", error);
    sendResponse(res, 500, null, true, "Error updating session: " + error.message);
  }
});

// Delete session
sessionRouter.delete("/:id", authorization, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return sendResponse(res, 404, null, true, "Session not found");
    }

    // Check authorization
    if (
      session.teacherId.toString() !== req.user._id.toString() &&
      req.user.role !== "Admin"
    ) {
      return sendResponse(res, 403, null, true, "Access denied");
    }

    await session.deleteOne();

    sendResponse(res, 200, null, false, "Session deleted successfully");
  } catch (error) {
    console.error("Error deleting session:", error);
    sendResponse(res, 500, null, true, "Error deleting session: " + error.message);
  }
});

export default sessionRouter;
