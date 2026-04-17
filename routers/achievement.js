import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import Achievement from "../models/Achievement.js";

const achievementRouter = express.Router();

// Default achievements template
const defaultAchievements = [
  {
    achievementId: "first_lesson",
    title: "First Steps",
    description: "Complete your first lesson",
    icon: "BookOpen",
    category: "milestone",
    criteria: { lessonsCompleted: 1 },
  },
  {
    achievementId: "perfect_attendance_week",
    title: "Perfect Week",
    description: "100% attendance for one week",
    icon: "Calendar",
    category: "attendance",
    criteria: { attendance: 100, daysStreak: 7 },
  },
  {
    achievementId: "excellent_rating",
    title: "Excellence",
    description: "Receive 5-star rating from teacher",
    icon: "Star",
    category: "performance",
    criteria: { teacherRating: 5 },
  },
  {
    achievementId: "ten_lessons",
    title: "Dedicated Learner",
    description: "Complete 10 lessons",
    icon: "Target",
    category: "milestone",
    criteria: { lessonsCompleted: 10 },
  },
  {
    achievementId: "streak_30",
    title: "Consistency Master",
    description: "30-day learning streak",
    icon: "Zap",
    category: "attendance",
    criteria: { daysStreak: 30 },
  },
  {
    achievementId: "perfect_attendance_month",
    title: "Perfect Month",
    description: "100% attendance for one month",
    icon: "Trophy",
    category: "attendance",
    criteria: { attendance: 100, daysStreak: 30 },
  },
  {
    achievementId: "fast_learner",
    title: "Fast Learner",
    description: "Complete 5 lessons in one week",
    icon: "TrendingUp",
    category: "performance",
    criteria: { lessonsCompleted: 5 },
  },
  {
    achievementId: "early_bird",
    title: "Early Bird",
    description: "Join 10 morning classes",
    icon: "Clock",
    category: "special",
    criteria: { lessonsCompleted: 10 },
  },
];

// Initialize achievements for a student
async function initializeAchievements(studentId) {
  const existingCount = await Achievement.countDocuments({ studentId });
  
  if (existingCount === 0) {
    const achievements = defaultAchievements.map(achievement => ({
      ...achievement,
      studentId,
      unlocked: false,
      progress: 0,
    }));
    
    await Achievement.insertMany(achievements);
  }
}

// Get student achievements
achievementRouter.get("/student/:studentId", authorization, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Initialize if not exists
    await initializeAchievements(studentId);

    const achievements = await Achievement.find({ studentId }).sort({ unlocked: -1, createdAt: 1 });

    sendResponse(res, 200, { achievements }, false, "Achievements fetched successfully");
  } catch (error) {
    console.error("Error fetching achievements:", error);
    sendResponse(res, 500, null, true, "Error fetching achievements: " + error.message);
  }
});

// Unlock an achievement
achievementRouter.post("/unlock", authorization, async (req, res) => {
  try {
    const { studentId, achievementId } = req.body;

    if (!studentId || !achievementId) {
      return sendResponse(res, 400, null, true, "Student ID and achievement ID are required");
    }

    const achievement = await Achievement.findOneAndUpdate(
      { studentId, achievementId },
      { 
        unlocked: true, 
        unlockedDate: new Date(),
        progress: 100 
      },
      { new: true }
    );

    if (!achievement) {
      return sendResponse(res, 404, null, true, "Achievement not found");
    }

    sendResponse(res, 200, { achievement }, false, "Achievement unlocked successfully");
  } catch (error) {
    console.error("Error unlocking achievement:", error);
    sendResponse(res, 500, null, true, "Error unlocking achievement: " + error.message);
  }
});

// Update achievement progress
achievementRouter.put("/progress", authorization, async (req, res) => {
  try {
    const { studentId, achievementId, progress } = req.body;

    if (!studentId || !achievementId || progress === undefined) {
      return sendResponse(res, 400, null, true, "Student ID, achievement ID, and progress are required");
    }

    const achievement = await Achievement.findOneAndUpdate(
      { studentId, achievementId },
      { progress: Math.min(progress, 100) },
      { new: true }
    );

    if (!achievement) {
      return sendResponse(res, 404, null, true, "Achievement not found");
    }

    sendResponse(res, 200, { achievement }, false, "Achievement progress updated");
  } catch (error) {
    console.error("Error updating achievement progress:", error);
    sendResponse(res, 500, null, true, "Error updating progress: " + error.message);
  }
});

export default achievementRouter;
