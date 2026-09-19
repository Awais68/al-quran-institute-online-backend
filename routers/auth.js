import express from "express";
import bcrypt from "bcrypt";
import sendResponse from "../helper/sendResponse.js";
import Joi from "joi";
import User from "../models/user.js";
import "dotenv/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Counter from "../models/counterSchema.js";
import sendMail from "../utils/sendMail.js";
import { createSendToken } from "../utils/jwt.js";
import { authorization } from "../middlewares/authtication.js";

const router = express.Router();

/**
 * Decides the role a public signup is allowed to create.
 *
 * Public registration may only ever create a Student. The single exception is
 * bootstrapping the very first Admin on an empty installation — once any admin
 * exists, privileged accounts can only be created by an authenticated admin
 * (POST /teacher for teachers, PUT /user/admin/updateUser/:userId for roles).
 *
 * Returns { role } on success, or { error } with a message to reject with.
 */
const resolveSignupRole = async (requestedRole) => {
  if (!requestedRole || requestedRole === "Student") {
    return { role: "Student" };
  }

  if (requestedRole === "Admin") {
    const adminCount = await User.countDocuments({ role: "Admin" });
    if (adminCount === 0) {
      // First admin on a fresh install — allowed, and activated immediately.
      return { role: "Admin", bootstrap: true };
    }
  }

  return {
    error:
      "Teacher and admin accounts cannot be self-registered. Ask an administrator to create the account.",
  };
};

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
  // Accepted so the conditional rules below still resolve and so an explicit
  // privileged request can be rejected with a clear message, but the value is
  // NEVER trusted: the role actually stored is decided server-side in the
  // handler by resolveSignupRole().
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

    // The client does not get to pick its own role.
    const resolved = await resolveSignupRole(value.role);
    if (resolved.error) {
      return sendResponse(res, 403, null, true, resolved.error);
    }
    const role = resolved.role;

    const hashedPassword = await bcrypt.hash(value.password, 12);

    // Generate roll number only for students
    let rollNumber;
    if (role === 'Student') {
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

    // Create user object, only include roll_no if it exists.
    // `role` is set from the server-resolved value, never from the request body.
    const userData = {
      ...value,
      role,
      password: hashedPassword,
      status: 'active',
    };

    // Handle date conversion for dob if it exists and is a string
    if (value.dob && typeof value.dob === 'string') {
      userData.dob = new Date(value.dob);
    }
    
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

    // Checked only after the password, so this cannot be used to probe which
    // accounts exist.
    if (user.status === "inactive") {
      return sendResponse(
        res,
        403,
        null,
        true,
        "This account has been deactivated. Please contact the administrator."
      );
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

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters with uppercase, lowercase, number and special character",
    "any.required": "New password is required",
  }),
});

// Changing your own password. This is the only endpoint an account with
// `mustResetPassword` can reach (see middlewares/authtication.js), so it is
// also the exit from the forced-reset state an admin-created teacher starts in.
router.post("/change-password", authorization, async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendResponse(res, 400, null, true, errors.join(", "));
    }

    // req.user arrives from the middleware without the password field.
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return sendResponse(res, 404, null, true, "User not found");
    }

    const matches = await bcrypt.compare(value.currentPassword, user.password);
    if (!matches) {
      return sendResponse(res, 401, null, true, "Current password is incorrect");
    }

    if (value.currentPassword === value.newPassword) {
      return sendResponse(
        res,
        400,
        null,
        true,
        "The new password must be different from the current one"
      );
    }

    user.password = await bcrypt.hash(value.newPassword, 12);
    user.mustResetPassword = false;
    // Legacy documents predate some of the current schema rules; only validate
    // what this request actually touches.
    await user.save({ validateModifiedOnly: true });

    // Hand back a fresh token so the client can continue with the same session.
    createSendToken(user, 200, res);
  } catch (err) {
    console.error("Change password error:", err);
    sendResponse(res, 500, null, true, "Error changing password: " + err.message);
  }
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Always answers 200 with the same text, whether or not the email exists, so
// the endpoint cannot be used to enumerate registered accounts.
const FORGOT_PASSWORD_REPLY =
  "If an account exists for that email, a password reset link has been sent.";

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return sendResponse(res, 400, null, true, "Email is required");
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user && user.status !== "inactive") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = hashResetToken(rawToken);
      user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save({ validateModifiedOnly: true });

      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;

      await sendMail(
        "Reset your Al-Quran Institute password",
        `<p>Assalam o Alaikum ${user.name},</p>
         <p>We received a request to reset your password. This link is valid for one hour:</p>
         <p><a href="${resetUrl}">Reset my password</a></p>
         <p>If you did not request this, you can ignore this email - your password stays unchanged.</p>`,
        user.email
      );
    }

    return sendResponse(res, 200, null, false, FORGOT_PASSWORD_REPLY);
  } catch (err) {
    console.error("Forgot password error:", err);
    sendResponse(res, 500, null, true, "Error starting password reset: " + err.message);
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendResponse(res, 400, null, true, "Reset token and new password are required");
    }
    if (typeof newPassword !== "string" || !passwordPattern.test(newPassword)) {
      return sendResponse(
        res,
        400,
        null,
        true,
        "Password must contain at least 8 characters with uppercase, lowercase, number and special character"
      );
    }

    const user = await User.findOne({
      passwordResetToken: hashResetToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select("+password +passwordResetToken +passwordResetExpires");

    if (!user) {
      return sendResponse(res, 400, null, true, "This reset link is invalid or has expired");
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // A completed reset also clears any admin-forced temporary password.
    user.mustResetPassword = false;
    await user.save({ validateModifiedOnly: true });

    return sendResponse(res, 200, null, false, "Password reset successfully. You can now log in.");
  } catch (err) {
    console.error("Reset password error:", err);
    sendResponse(res, 500, null, true, "Error resetting password: " + err.message);
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
