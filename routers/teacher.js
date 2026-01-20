import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization, { authenticateAdmin } from "../middlewares/authtication.js";
import Teacher from "../models/Teacher.js";
import Joi from "joi";

const teacherRoutes = express.Router();

// Validation schema for teacher
const teacherSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    'string.min': 'Name must be at least 3 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net", "org", "edu", "gov", "co"] } })
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  phone: Joi.string().min(10).max(15).required().messages({
    'string.min': 'Phone number must be at least 10 digits',
    'string.max': 'Phone number cannot exceed 15 digits',
    'any.required': 'Phone number is required'
  }),
  gender: Joi.string().valid("male", "female", "other").required().messages({
    'any.only': 'Gender must be male, female, or other',
    'any.required': 'Gender is required'
  }),
  specialization: Joi.array().items(
    Joi.string().valid(
      "Qaida",
      "Tajweed",
      "Nazra",
      "Hifz",
      "Namaz",
      "Arabic",
      "Islamic Studies"
    )
  ).min(1).required().messages({
    'array.min': 'At least one specialization is required',
    'any.required': 'Specialization is required'
  }),
  experience: Joi.number().min(0).optional(),
  qualification: Joi.string().max(200).optional(),
  image: Joi.string().uri().optional(),
  availability: Joi.array().items(
    Joi.string().valid(
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    )
  ).optional(),
  status: Joi.string().valid('active', 'inactive', 'on-leave').optional(),
  assignedStudents: Joi.array().items(Joi.string()).optional()
});

// Get all teachers (Admin only)
teacherRoutes.get("/", authenticateAdmin, async (req, res) => {
  try {
    const { status, specialization, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (specialization) filter.specialization = specialization;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const teachers = await Teacher.find(filter)
      .populate('assignedStudents', 'name email course')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Teacher.countDocuments(filter);

    sendResponse(res, 200, { 
      teachers, 
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    }, false, "Teachers fetched successfully");
  } catch (err) {
    console.error("Error fetching teachers:", err);
    sendResponse(res, 500, null, true, "Error fetching teachers: " + err.message);
  }
});

// Get single teacher by ID
teacherRoutes.get("/:id", authorization, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('assignedStudents', 'name email course phone');

    if (!teacher) {
      return sendResponse(res, 404, null, true, "Teacher not found");
    }

    sendResponse(res, 200, teacher, false, "Teacher fetched successfully");
  } catch (err) {
    console.error("Error fetching teacher:", err);
    sendResponse(res, 500, null, true, "Error fetching teacher: " + err.message);
  }
});

// Create new teacher (Admin only)
teacherRoutes.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { error, value } = teacherSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return sendResponse(res, 400, null, true, errors.join(', '));
    }

    const existingTeacher = await Teacher.findOne({ email: value.email });
    if (existingTeacher) {
      return sendResponse(res, 409, null, true, "Teacher already exists with this email");
    }

    const newTeacher = new Teacher(value);
    await newTeacher.save();

    sendResponse(res, 201, newTeacher, false, "Teacher created successfully");
  } catch (err) {
    console.error("Error creating teacher:", err);
    sendResponse(res, 500, null, true, "Error creating teacher: " + err.message);
  }
});

// Update teacher (Admin only)
teacherRoutes.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'phone', 'gender', 'specialization', 'experience', 
      'qualification', 'image', 'availability', 'status', 'assignedStudents'
    ];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('assignedStudents', 'name email course');

    if (!teacher) {
      return sendResponse(res, 404, null, true, "Teacher not found");
    }

    sendResponse(res, 200, teacher, false, "Teacher updated successfully");
  } catch (err) {
    console.error("Error updating teacher:", err);
    sendResponse(res, 400, null, true, "Error updating teacher: " + err.message);
  }
});

// Delete teacher (Admin only)
teacherRoutes.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);

    if (!teacher) {
      return sendResponse(res, 404, null, true, "Teacher not found");
    }

    sendResponse(res, 200, teacher, false, "Teacher deleted successfully");
  } catch (err) {
    console.error("Error deleting teacher:", err);
    sendResponse(res, 500, null, true, "Error deleting teacher: " + err.message);
  }
});

// Assign students to teacher (Admin only)
teacherRoutes.post("/:id/assign-students", authenticateAdmin, async (req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds)) {
      return sendResponse(res, 400, null, true, "Student IDs array is required");
    }

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return sendResponse(res, 404, null, true, "Teacher not found");
    }

    teacher.assignedStudents = [...new Set([...teacher.assignedStudents, ...studentIds])];
    await teacher.save();

    const updatedTeacher = await Teacher.findById(req.params.id)
      .populate('assignedStudents', 'name email course');

    sendResponse(res, 200, updatedTeacher, false, "Students assigned successfully");
  } catch (err) {
    console.error("Error assigning students:", err);
    sendResponse(res, 500, null, true, "Error assigning students: " + err.message);
  }
});

// Get teacher statistics (Admin only)
teacherRoutes.get("/stats/overview", authenticateAdmin, async (req, res) => {
  try {
    const totalTeachers = await Teacher.countDocuments();
    const activeTeachers = await Teacher.countDocuments({ status: 'active' });
    const inactiveTeachers = await Teacher.countDocuments({ status: 'inactive' });
    const onLeaveTeachers = await Teacher.countDocuments({ status: 'on-leave' });

    const specializationStats = await Teacher.aggregate([
      { $unwind: '$specialization' },
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    sendResponse(res, 200, {
      total: totalTeachers,
      active: activeTeachers,
      inactive: inactiveTeachers,
      onLeave: onLeaveTeachers,
      specializationStats
    }, false, "Teacher statistics fetched successfully");
  } catch (err) {
    console.error("Error fetching teacher statistics:", err);
    sendResponse(res, 500, null, true, "Error fetching statistics: " + err.message);
  }
});

export default teacherRoutes;
