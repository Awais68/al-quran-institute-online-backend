import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization, { authenticateAdmin } from "../middlewares/authtication.js";
import User from "../models/user.js";
import bcrypt from "bcrypt";
import Joi from "joi";

const userRoutes = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(3).max(30).optional(),
  fatherName: Joi.string().min(3).max(30).optional(),
  phone: Joi.string().min(10).max(15).optional(),
  city: Joi.string().allow("", null).optional(),
  country: Joi.string().optional(),
  age: Joi.number().min(1).max(120).optional(),
  dob: Joi.string().optional(),
  app: Joi.string().valid("WhatsApp", "Teams", "Google Meet", "Telegram", "Zoom").optional(),
  suitableTime: Joi.string().optional(),
  course: Joi.string().valid("Qaida", "Tajweed", "Nazra", "Hifz", "Namaz", "Arabic", "Islamic Studies").optional(),
  classDays: Joi.array().items(
    Joi.string().valid("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
  ).optional(),
  image: Joi.string().uri().optional(),
  gender: Joi.string().valid("male", "female", "other").optional()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.pattern.base': 'New password must contain at least 8 characters with uppercase, lowercase, number and special character',
      'any.required': 'New password is required'
    })
});

const adminUpdateUserSchema = Joi.object({
  role: Joi.string().valid("Admin", "Student", "Teacher").optional(),
  fees: Joi.number().min(0).optional(),
  suitableTime: Joi.string().optional(),
  course: Joi.string().valid("Qaida", "Tajweed", "Nazra", "Hifz", "Namaz", "Arabic", "Islamic Studies").optional(),
  classDays: Joi.array().items(
    Joi.string().valid("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
  ).optional(),
  status: Joi.string().valid('active', 'inactive', 'pending').optional(),
  assignedTeacher: Joi.string().optional()
});

userRoutes.get("/student", authorization, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return sendResponse(res, 404, null, true, "User not found");
    }
    sendResponse(res, 200, user, false, "User fetched successfully");
  } catch (err) {
    console.error("Error fetching user:", err);
    sendResponse(res, 500, null, true, "Something went wrong: " + err.message);
  }
});

// User updates their own profile
userRoutes.put("/updateUser", authorization, async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return sendResponse(res, 400, null, true, errors.join(', '));
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: value },
      { new: true, runValidators: true }
    ).select("-password").populate('assignedTeacher', 'name email specialization');

    if (!user) {
      return sendResponse(res, 404, null, true, "User not found");
    }

    sendResponse(res, 200, user, false, "Profile updated successfully");
  } catch (err) {
    console.error("Error updating user:", err);
    sendResponse(res, 400, null, true, "Error updating profile: " + err.message);
  }
});

// User changes their own password
userRoutes.put("/changePassword", authorization, async (req, res) => {
  try {
    const { error, value } = updatePasswordSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return sendResponse(res, 400, null, true, errors.join(', '));
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return sendResponse(res, 404, null, true, "User not found");
    }

    const isPasswordValid = await bcrypt.compare(value.currentPassword, user.password);
    if (!isPasswordValid) {
      return sendResponse(res, 401, null, true, "Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(value.newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    sendResponse(res, 200, null, false, "Password changed successfully");
  } catch (err) {
    console.error("Error changing password:", err);
    sendResponse(res, 500, null, true, "Error changing password: " + err.message);
  }
});

// Admin gets all users
userRoutes.get("/getUser", authenticateAdmin, async (req, res) => {
  try {
    const { role, status, course, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (course) filter.course = course;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select("-password")
      .populate('assignedTeacher', 'name email specialization')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    sendResponse(res, 200, {
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    }, false, "Users fetched successfully");
  } catch (err) {
    console.error("Error fetching users:", err);
    sendResponse(res, 500, null, true, "Error fetching users: " + err.message);
  }
});

// Admin updates any user
userRoutes.put("/admin/updateUser/:userId", authenticateAdmin, async (req, res) => {
  try {
    const { error, value } = adminUpdateUserSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return sendResponse(res, 400, null, true, errors.join(', '));
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: value },
      { new: true, runValidators: true }
    ).select("-password").populate('assignedTeacher', 'name email specialization');

    if (!user) {
      return sendResponse(res, 404, null, true, "User not found");
    }

    sendResponse(res, 200, user, false, "User updated successfully");
  } catch (err) {
    console.error("Error updating user:", err);
    sendResponse(res, 400, null, true, "Error updating user: " + err.message);
  }
});

// Admin deletes a user
userRoutes.delete("/admin/deleteUser/:userId", authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);

    if (!user) {
      return sendResponse(res, 404, null, true, "User not found");
    }

    sendResponse(res, 200, null, false, "User deleted successfully");
  } catch (err) {
    console.error("Error deleting user:", err);
    sendResponse(res, 500, null, true, "Error deleting user: " + err.message);
  }
});

// Get user statistics (Admin only)
userRoutes.get("/stats/overview", authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'Student' });
    const totalTeachers = await User.countDocuments({ role: 'Teacher' });
    const totalAdmins = await User.countDocuments({ role: 'Admin' });
    const activeUsers = await User.countDocuments({ status: 'active' });
    const pendingUsers = await User.countDocuments({ status: 'pending' });

    const courseStats = await User.aggregate([
      { $match: { role: 'Student' } },
      { $group: { _id: '$course', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    sendResponse(res, 200, {
      total: totalUsers,
      students: totalStudents,
      teachers: totalTeachers,
      admins: totalAdmins,
      active: activeUsers,
      pending: pendingUsers,
      courseStats
    }, false, "User statistics fetched successfully");
  } catch (err) {
    console.error("Error fetching user statistics:", err);
    sendResponse(res, 500, null, true, "Error fetching statistics: " + err.message);
  }
});

// Update student instructions (Teacher or Admin only)
userRoutes.patch("/students/:id/instructions", authorization, async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherInstructions, adminNotes } = req.body;
    const currentUser = req.user;

    // Verify user is Teacher or Admin
    if (currentUser.role !== 'Teacher' && currentUser.role !== 'Admin') {
      return sendResponse(res, 403, null, true, "Only teachers and admins can update instructions");
    }

    // Find the student
    const student = await User.findById(id);
    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }

    if (student.role !== 'Student') {
      return sendResponse(res, 400, null, true, "Instructions can only be added to students");
    }

    // Update instructions based on role
    const updateData = {};
    if (currentUser.role === 'Teacher' && teacherInstructions !== undefined) {
      updateData.teacherInstructions = teacherInstructions;
    }
    if (currentUser.role === 'Admin') {
      if (teacherInstructions !== undefined) updateData.teacherInstructions = teacherInstructions;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    }

    const updatedStudent = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    sendResponse(res, 200, updatedStudent, false, "Instructions updated successfully");
  } catch (err) {
    console.error("Error updating instructions:", err);
    sendResponse(res, 500, null, true, "Error updating instructions: " + err.message);
  }
});

export default userRoutes;

