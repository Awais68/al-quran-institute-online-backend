import express from "express";
import sendResponse from "../helper/sendResponse.js";
import register from "../models/user.js";

const router = express.Router();

// Get all students with pagination
router.get("/getAllStudents", async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filtering
    const filter = {};
    if (req.query.course) {
      filter.course = req.query.course;
    }
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.country) {
      filter.country = req.query.country;
    }

    // Sorting
    const sort = req.query.sort || '-createdAt';

    const students = await register
      .find(filter)
      .select("-password") // Don't return passwords
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await register.countDocuments(filter);

    sendResponse(res, 200, {
      students,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalStudents: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }, false, "Students fetched successfully");
  } catch (error) {
    console.error("Error fetching students:", error);
    sendResponse(res, 500, null, true, "Something went wrong: " + error.message);
  }
});

export default router;
