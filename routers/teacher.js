import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import sendResponse from "../helper/sendResponse.js";
import authorization, { authenticateAdmin } from "../middlewares/authtication.js";
import User from "../models/user.js";
import Joi from "joi";
import sendMail from "../utils/sendMail.js";

const teacherRoutes = express.Router();

// Teachers are ordinary User documents with role === "Teacher". Every query
// here is scoped by TEACHER_FILTER so a teacher endpoint can never read or
// write a student or admin account.
const TEACHER_FILTER = { role: "Teacher" };

// Fields safe to expose to any authenticated caller. Deliberately excludes
// adminNotes, feeHistory and the other account-internal fields on User.
const PUBLIC_TEACHER_FIELDS =
  "name email phone gender image specialization availability qualification experience expertise bio status joinDate assignedStudents createdAt";

const COURSES = [
  "Qaida",
  "Tajweed",
  "Nazra",
  "Hifz",
  "Namaz",
  "Arabic",
  "Islamic Studies",
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Validation schema for creating a teacher.
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
  country: Joi.string().required().messages({
    'any.required': 'Country is required'
  }),
  city: Joi.string().allow("", null).optional(),
  specialization: Joi.array().items(Joi.string().valid(...COURSES)).min(1).required().messages({
    'array.min': 'At least one specialization is required',
    'any.required': 'Specialization is required'
  }),
  // The User schema stores experience as a string; accept either and coerce.
  experience: Joi.alternatives().try(Joi.number().min(0), Joi.string()).optional(),
  qualification: Joi.string().max(200).optional(),
  expertise: Joi.string().optional(),
  bio: Joi.string().max(500).optional(),
  image: Joi.string().uri().optional(),
  availability: Joi.array().items(Joi.string().valid(...DAYS)).optional(),
  status: Joi.string().valid('active', 'inactive', 'on-leave').optional(),
  assignedStudents: Joi.array().items(Joi.string()).optional(),
  // Optional: let the admin set the initial password. If omitted, one is
  // generated and returned once in the response.
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .optional()
    .messages({
      'string.pattern.base':
        'Password must contain at least 8 characters with uppercase, lowercase, number and special character',
    }),
});

// Generates a password that satisfies the schema's complexity pattern.
const generatePassword = () => {
  const pick = (chars, n) =>
    Array.from({ length: n }, () => chars[crypto.randomInt(chars.length)]).join("");
  const password =
    pick("ABCDEFGHJKLMNPQRSTUVWXYZ", 3) +
    pick("abcdefghijkmnpqrstuvwxyz", 4) +
    pick("23456789", 3) +
    pick("@$!%*?&", 2);
  // Shuffle so the character classes are not always in the same positions.
  return password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
};

// Emails a newly created teacher their login details. Returns whether the mail
// went out; the caller decides what to tell the admin.
const sendCredentialsMail = async (teacher, plainPassword) => {
  const loginUrl = `${(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/login`;

  return sendMail(
    "Your teacher account - Al-Quran Institute Online",
    `<p>Assalam-o-Alaikum ${teacher.name},</p>
     <p>An account has been created for you at Al-Quran Institute Online.</p>
     <p>
       <b>Email:</b> ${teacher.email}<br>
       <b>Temporary password:</b> ${plainPassword}
     </p>
     <p>You will be asked to choose a new password the first time you sign in${
       loginUrl.startsWith("http") ? ` at <a href="${loginUrl}">${loginUrl}</a>` : ""
     }.</p>
     <p>Please do not share this email with anyone.</p>`,
    teacher.email
  );
};

// Get all teachers (Admin only)
teacherRoutes.get("/", authenticateAdmin, async (req, res) => {
  try {
    const { status, specialization, page = 1, limit = 50 } = req.query;

    const filter = { ...TEACHER_FILTER };
    if (status) filter.status = status;
    if (specialization) filter.specialization = specialization;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const teachers = await User.find(filter)
      .select("-password")
      .populate('assignedStudents', 'name email course')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

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

// Get teacher statistics (Admin only)
// Declared before "/:id" so the literal path is not swallowed by the param route.
teacherRoutes.get("/stats/overview", authenticateAdmin, async (req, res) => {
  try {
    const [totalTeachers, activeTeachers, inactiveTeachers, onLeaveTeachers] =
      await Promise.all([
        User.countDocuments(TEACHER_FILTER),
        User.countDocuments({ ...TEACHER_FILTER, status: 'active' }),
        User.countDocuments({ ...TEACHER_FILTER, status: 'inactive' }),
        User.countDocuments({ ...TEACHER_FILTER, status: 'on-leave' }),
      ]);

    const specializationStats = await User.aggregate([
      { $match: TEACHER_FILTER },
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

// Get single teacher by ID
teacherRoutes.get("/:id", authorization, async (req, res) => {
  try {
    const isAdmin = req.user.role === "Admin";
    const query = User.findOne({ _id: req.params.id, ...TEACHER_FILTER });

    const teacher = await (isAdmin ? query.select("-password") : query.select(PUBLIC_TEACHER_FIELDS))
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
// Creates a real login account (role "Teacher") in the users collection.
teacherRoutes.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { error, value } = teacherSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return sendResponse(res, 400, null, true, errors.join(', '));
    }

    const existing = await User.findOne({ email: value.email });
    if (existing) {
      return sendResponse(
        res,
        409,
        null,
        true,
        existing.role === "Teacher"
          ? "Teacher already exists with this email"
          : `An account with this email already exists with role ${existing.role}`
      );
    }

    // The admin may supply a password; otherwise generate one and hand it back
    // exactly once so it can be passed on to the teacher.
    const generatedPassword = value.password ? null : generatePassword();
    const plainPassword = value.password || generatedPassword;

    const newTeacher = new User({
      ...value,
      role: "Teacher",
      password: await bcrypt.hash(plainPassword, 12),
      mustResetPassword: !value.password,
      status: value.status || "active",
      // The User schema requires these for teachers; fall back to the
      // specialization list rather than rejecting an otherwise valid request.
      expertise: value.expertise || value.specialization.join(", "),
      qualification: value.qualification || "Not specified",
      experience: value.experience === undefined ? "0" : String(value.experience),
    });
    await newTeacher.save();

    const { password, ...teacherWithoutPassword } = newTeacher.toObject();

    // Mail the credentials to the teacher. Awaited, not fire-and-forget: if the
    // mail does not go out the admin has to be told, because the generated
    // password exists nowhere else.
    const emailSent = await sendCredentialsMail(newTeacher, plainPassword);

    sendResponse(
      res,
      201,
      {
        ...teacherWithoutPassword,
        emailSent,
        // Only surfaced when the mail failed, so the admin can pass the password
        // on by hand. On success it is never returned.
        ...(generatedPassword && !emailSent ? { generatedPassword } : {}),
      },
      false,
      emailSent
        ? "Teacher created successfully. Login details have been emailed to the teacher."
        : generatedPassword
          ? "Teacher created, but the email could not be sent. Share the generated password manually — it will not be shown again."
          : "Teacher created, but the email could not be sent. Share the login details manually."
    );
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
      'qualification', 'expertise', 'bio', 'image', 'availability',
      'status', 'assignedStudents'
    ];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // experience is stored as a string on User; accept numbers from older clients.
    if (updates.experience !== undefined) {
      updates.experience = String(updates.experience);
    }

    const teacher = await User.findOneAndUpdate(
      { _id: req.params.id, ...TEACHER_FILTER },
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password").populate('assignedStudents', 'name email course');

    if (!teacher) {
      return sendResponse(res, 404, null, true, "Teacher not found");
    }

    sendResponse(res, 200, teacher, false, "Teacher updated successfully");
  } catch (err) {
    console.error("Error updating teacher:", err);
    sendResponse(res, 400, null, true, "Error updating teacher: " + err.message);
  }
});

// Deactivate a teacher (Admin only)
//
// BEHAVIOUR CHANGE: a teacher row is now a real login account carrying sessions,
// lessons and message history, so this deactivates by default instead of
// destroying the account. Pass ?hard=true to actually delete the document.
teacherRoutes.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return sendResponse(res, 400, null, true, "You cannot delete your own account");
    }

    const hard = req.query.hard === "true";

    const teacher = hard
      ? await User.findOneAndDelete({ _id: req.params.id, ...TEACHER_FILTER }).select("-password")
      : await User.findOneAndUpdate(
          { _id: req.params.id, ...TEACHER_FILTER },
          { $set: { status: "inactive" } },
          { new: true }
        ).select("-password");

    if (!teacher) {
      return sendResponse(res, 404, null, true, "Teacher not found");
    }

    // Detach the teacher from any students still pointing at them.
    if (hard) {
      await User.updateMany(
        { assignedTeacher: teacher._id },
        { $unset: { assignedTeacher: "" } }
      );
    }

    sendResponse(
      res,
      200,
      teacher,
      false,
      hard ? "Teacher deleted successfully" : "Teacher deactivated successfully"
    );
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

    const teacher = await User.findOne({ _id: req.params.id, ...TEACHER_FILTER });
    if (!teacher) {
      return sendResponse(res, 404, null, true, "Teacher not found");
    }

    // Only accept ids that really are students, so the assignment list cannot
    // be seeded with admin or teacher accounts.
    const students = await User.find({ _id: { $in: studentIds }, role: "Student" }).select("_id");
    if (students.length !== studentIds.length) {
      return sendResponse(res, 400, null, true, "One or more IDs are not valid student accounts");
    }

    const merged = new Set((teacher.assignedStudents || []).map(id => id.toString()));
    students.forEach(s => merged.add(s._id.toString()));
    teacher.assignedStudents = [...merged];
    await teacher.save({ validateModifiedOnly: true });

    // Keep the reverse pointer on each student in sync.
    await User.updateMany(
      { _id: { $in: students.map(s => s._id) } },
      { $set: { assignedTeacher: teacher._id } }
    );

    const updatedTeacher = await User.findById(req.params.id)
      .select("-password")
      .populate('assignedStudents', 'name email course');

    sendResponse(res, 200, updatedTeacher, false, "Students assigned successfully");
  } catch (err) {
    console.error("Error assigning students:", err);
    sendResponse(res, 500, null, true, "Error assigning students: " + err.message);
  }
});

export default teacherRoutes;
