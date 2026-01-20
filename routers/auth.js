import express from "express";
import bcrypt from "bcrypt";
import sendResponse from "../helper/sendResponse.js";
import Joi from "joi";
import User from "../models/user.js";
import "dotenv/config";
import jwt from "jsonwebtoken";
import cors from "cors";
import Counter from "../models/counterSchema.js";
import sendMail from "../utils/sendMail.js";
import { createSendToken } from "../utils/jwt.js";

const app = express();
app.use(cors());
const router = express.Router();

// Stronger password validation
const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const Registerschema = Joi.object({
  name: Joi.string().min(3).max(30).required().messages({
    "string.min": "Name must be at least 3 characters long",
    "string.max": "Name cannot exceed 30 characters",
    "any.required": "Name is required",
  }),
  fatherName: Joi.string().min(3).max(30).when('role', {
    is: 'Student',
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    "string.min": "Father name must be at least 3 characters long",
    "string.max": "Father name cannot exceed 30 characters",
    "any.required": "Father name is required for students",
  }),
  email: Joi.string()
    .email({
      minDomainSegments: 2,
      tlds: { allow: ["com", "net", "org", "edu", "gov", "co"] },
    })
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  gender: Joi.string().valid("male", "female", "other").required().messages({
    "any.only": "Gender must be male, female, or other",
    "any.required": "Gender is required",
  }),
  phone: Joi.string().min(10).max(15).required().messages({
    "string.min": "Phone number must be at least 10 digits",
    "string.max": "Phone number cannot exceed 15 digits",
    "any.required": "Phone number is required",
  }),
  city: Joi.string().allow("", null).optional(),
  country: Joi.string().required().messages({
    "any.required": "Country is required",
  }),

  dob: Joi.date().when('role', {
    is: 'Student',
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    "any.required": "Date of birth is required for students",
  }),
  age: Joi.number().when('role', {
    is: 'Student',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  app: Joi.string()
    .valid("WhatsApp", "Teams", "Google Meet", "Telegram", "Zoom")
    .when('role', {
      is: 'Student',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      "any.only":
        "Application must be one of WhatsApp, Teams, Google Meet, Telegram, or Zoom",
    }),
  suitableTime: Joi.string().when('role', {
    is: 'Student',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  course: Joi.string()
    .valid(
      "Qaida",
      "Tajweed",
      "Nazra",
      "Hifz",
      "Namaz",
      "Arabic",
      "Islamic Studies"
    )
    .when('role', {
      is: 'Student',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      "any.only": "Course must be one of the available courses",
    }),
  role: Joi.string()
    .valid("Admin", "Student", "Teacher")
    .default("Student")
    .messages({
      "any.only": "Role must be Admin, Student, or Teacher",
    }),
  classDays: Joi.array().items(
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
  
  // Teacher-specific fields
  qualification: Joi.string().when('role', {
    is: 'Teacher',
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    "any.required": "Qualification is required for teachers",
  }),
  experience: Joi.string().when('role', {
    is: 'Teacher',
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    "any.required": "Experience is required for teachers",
  }),
  expertise: Joi.string().when('role', {
    is: 'Teacher',
    then: Joi.required(),
    otherwise: Joi.optional()
  }).messages({
    "any.required": "Expertise is required for teachers",
  }),
  bio: Joi.string().max(500).optional().messages({
    "string.max": "Bio cannot exceed 500 characters",
  }),
  
  password: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters with uppercase, lowercase, number and special character",
    "any.required": "Password is required",
  }),
  image: Joi.string().uri().optional(),
});

const loginschema = Joi.object({
  email: Joi.string()
    .email({
      minDomainSegments: 2,
      tlds: { allow: ["com", "net", "org", "edu", "gov", "co"] },
    })
    .required()
    .messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long",
    "any.required": "Password is required",
  }),
});

router.post("/signup", async (req, res) => {
  try {
    const { error, value } = Registerschema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendResponse(res, 400, null, true, errors.join(", "));
    }

    const user = await User.findOne({ email: value.email });
    if (user) {
      return sendResponse(res, 409, null, true, "User already exists with this email");
    }

    const hashedPassword = await bcrypt.hash(value.password, 12);

    // Generate roll number only for students
    let rollNumber;
    if (value.role === 'Student') {
      const getNextRollNo = async () => {
        const counter = await Counter.findOneAndUpdate(
          { id: "roll_no" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        return counter.seq;
      };
      rollNumber = await getNextRollNo();
    }

    // Check if this is the first admin
    let userStatus = 'pending';
    if (value.role === 'Admin') {
      const existingAdminCount = await User.countDocuments({ role: 'Admin' });
      if (existingAdminCount === 0) {
        // First admin - automatically activate
        userStatus = 'active';
      }
    } else {
      // Students and Teachers are active by default
      userStatus = 'active';
    }

    // Create user object, only include roll_no if it exists
    const userData = {
      ...value,
      password: hashedPassword,
      status: userStatus,
    };
    
    // Only add roll_no if it's defined (for students)
    if (rollNumber !== undefined) {
      userData.roll_no = rollNumber;
    }

    const newUser = new User(userData);
    await newUser.save();

    // Send email to admin after successful registration (non-blocking)
    sendMail(
      "New Registration - Al-Quran Institute Online",
      `<b>New User Registered:</b><br>
      <b>Name:</b> ${value.name}<br>
      <b>Email:</b> ${value.email}<br>
      <b>Phone:</b> ${value.phone}<br>
      <b>Course:</b> ${value.course || 'N/A'}<br>
      <b>Country:</b> ${value.country}<br>
      <b>Registration Time:</b> ${new Date().toISOString()}`
    ).catch(err => {
      console.warn("Email to admin failed to send:", err.message);
    });

    // Send success response without password
    const { password, ...userWithoutPassword } = newUser.toObject();
    createSendToken({ ...userWithoutPassword }, 201, res);
  } catch (err) {
    console.error("Signup error:", err);
    sendResponse(
      res,
      500,
      null,
      true,
      "An unexpected error occurred during registration: " + err.message
    );
  }
});

router.post("/login", async (req, res) => {
  try {
    const { error, value } = loginschema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendResponse(res, 400, null, true, errors.join(", "));
    }

    const user = await User.findOne({ email: value.email }).select("+password");
    if (!user) {
      return sendResponse(res, 401, null, true, "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(value.password, user.password);
    if (!isPasswordValid) {
      return sendResponse(res, 401, null, true, "Invalid email or password");
    }

    // Send success response with token
    createSendToken(user, 200, res);
  } catch (err) {
    console.error("Login error:", err);
    sendResponse(
      res,
      500,
      null,
      true,
      "An unexpected error occurred during login: " + err.message
    );
  }
});

router.post("/logout", (req, res) => {
  try {
    // Clear the authentication token cookie
    res.cookie("token", "", {
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    sendResponse(res, 200, null, false, "Logged out successfully");
  } catch (err) {
    console.error("Logout error:", err);
    sendResponse(
      res,
      500,
      null,
      true,
      "An unexpected error occurred during logout: " + err.message
    );
  }
});

export default router;
