import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import register from "../models/user.js";

const router = express.Router();

// Staff-only guard. This router used to be completely open, which published
// every user record (students, teachers and admins) to anonymous callers.
const staffOnly = (req, res, next) => {
  if (req.user?.role === "Admin" || req.user?.role === "Teacher") return next();
  return sendResponse(res, 403, null, true, "You are not allowed to access student records");
};

// A teacher may only ever see or touch the students assigned to them.
const teacherScope = (user) =>
  user.role === "Teacher"
    ? {
        $or: [
          { assignedTeacher: user._id },
          { _id: { $in: user.assignedStudents || [] } },
        ],
      }
    : {};

// Only these may be changed through the student profile editor. Anything else
// (role, password, email, fee amounts) needs the admin user routes.
const EDITABLE_FIELDS = ["phone", "country", "city", "course", "suitableTime", "days"];

// Get all students with pagination
router.get("/getAllStudents", authorization, staffOnly, async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 200);
    const skip = (page - 1) * limit;

    // Filtering. Defaults to students only - the previous default returned
    // every user in the collection regardless of role.
    const filter = { role: req.query.role || "Student", ...teacherScope(req.user) };
    if (req.query.course) {
      filter.course = req.query.course;
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

// Get a single student
router.get("/getAStudent/:id", authorization, async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = req.user._id.toString() === id;

    if (!isSelf && req.user.role !== "Admin" && req.user.role !== "Teacher") {
      return sendResponse(res, 403, null, true, "You are not allowed to view this student");
    }

    const filter = { _id: id, ...teacherScope(req.user) };
    const student = await register.findOne(isSelf ? { _id: id } : filter).select("-password");

    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }

    sendResponse(res, 200, { student }, false, "Student fetched successfully");
  } catch (error) {
    console.error("Error fetching student:", error);
    sendResponse(res, 500, null, true, "Something went wrong: " + error.message);
  }
});

// Update a student's own profile details
router.put("/updateStudent/:id", authorization, async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = req.user._id.toString() === id;

    if (!isSelf && req.user.role !== "Admin" && req.user.role !== "Teacher") {
      return sendResponse(res, 403, null, true, "You are not allowed to update this student");
    }

    const filter = { _id: id, ...(isSelf ? {} : teacherScope(req.user)) };
    const student = await register.findOne(filter);

    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    }

    await student.save({ validateModifiedOnly: true });

    const updated = await register.findById(id).select("-password");
    sendResponse(res, 200, { student: updated }, false, "Student updated successfully");
  } catch (error) {
    console.error("Error updating student:", error);
    sendResponse(res, 500, null, true, "Something went wrong: " + error.message);
  }
});

// Toggle / set a student's fee status (admin only)
router.patch("/updateFeeStatus/:id", authorization, async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return sendResponse(res, 403, null, true, "Only an admin can update fee status");
    }

    const { feesPaid } = req.body;
    if (typeof feesPaid !== "boolean") {
      return sendResponse(res, 400, null, true, "feesPaid must be true or false");
    }

    const student = await register.findById(req.params.id);
    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }

    student.feesPaid = feesPaid;
    await student.save({ validateModifiedOnly: true });

    sendResponse(res, 200, { studentId: student._id, feesPaid: student.feesPaid }, false, "Fee status updated successfully");
  } catch (error) {
    console.error("Error updating fee status:", error);
    sendResponse(res, 500, null, true, "Something went wrong: " + error.message);
  }
});

export default router;
