import express from "express";
import bcrypt from "bcrypt";
import sendResponse from "../helper/sendResponse.js";
import Joi from "joi";
import User from "../models/user.js";
import "dotenv/config";
import jwt from "jsonwebtoken";
import cors from "cors";
import nodemailer from "nodemailer";
import Counter from "../models/counterSchema.js";
import sendMail from "../utils/sendMail.js";

// import authorization from "../middlewares/authtication.js";

const sendToAdmin = async (req, res) => {
  const subject = "You have  Notifications ";
  const message = "Hello Admin! A new user just signed up.";

  const result = await sendMail(subject, message);
  res.send(result);
};

const app = express();
app.use(cors());
const router = express.Router();

const Registerschema = Joi.object({
  name: Joi.string().min(3).max(30).required(),
  fatherName: Joi.string().min(3).max(30).required(),
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
    .required(),
  gender: Joi.string().valid("male", "female", "other"),
  phone: Joi.string().min(10).max(20).required(),
  city: Joi.string().allow("", null).optional(),
  country: Joi.string().required(),

  // dob: Joi.string().valid().required(),
  dob: Joi.string(),
  // age: Joi.string().valid("child", "teen", "adult").required(),
  age: Joi.number().valid(),
  app: Joi.string().valid(
    "WhatsApp",
    "Teams",
    "Google Meet",
    "Telegram",
    "Zoom"
  ),
  suitableTime: Joi.string().valid(),
  suitableTime: Joi.string().valid(),
  course: Joi.string().valid(
    "Qaida",
    "Tajweed",
    "Nazra",
    "Hifz",
    "Namaz",
    "Arabic",
    "Islamic Studies"
  ),
  role: Joi.string().valid("Admin", "Student", "Teacher"),
  // role_no: Joi.string().valid(),
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
  ),
  // image: Joi.string(),
  password: Joi.string().min(8).required(),
  image: Joi.string().uri(),
});

const loginschema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
    .required(),
  password: Joi.string().min(3).required(),
});

const ADMIN_EMAIL = "aqionline786@gmail.com"; // Admin email

// Function to send email to admin
const sendAdminEmail = async (userEmail) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "aqionline786@gmail.com",
        pass: "cics roat rbyp viau",
      },
    });

    const info = await transporter.sendMail({
      from: '"Al-Quran Institute Online"<codetheagent1@gmail.com>', // sender
      to: ADMIN_EMAIL,
      to: "awaisniaz720@gmail.com", // admin

      subject: "Student Registered Successfully ",
      text: "hello World",
      html: "<b>Well Come Back Guys</b>",
      html: "<b>New user Signup in your WebSite </b>",
      html: `<b>Login By: ${userEmail}</b><br>
      <p>Registered at: ${new Date().toISOString()}</p>`,
      html: `<b>Login By: ${userEmail}</b><br>
      <p>Registered at: ${new Date().toISOString()}</p>`,
      html: `<b>Login By: ${userName}</b><br>
      <p>Registered at: ${new Date().toISOString()}</p>`,
    });
    //  <p>Name: ${userData.name}</p>
    //  <p>Course: ${userData.course}</p>
    await sendMail(
      "Mail Recives",
      `<b>Name:</b> ${value.name}<br><b>Email:</b> ${value.email}<br><b>Phone:</b> ${value.phone}<br><b>Subject:</b> ${value.subject}<br><b>Message:</b> ${value.message}`
    );

    return true;
  } catch (error) {
    return false;
  }
};

router.post("/signup", async (req, res) => {
  try {
    const { error, value } = Registerschema.validate(req.body);
    if (error) {
      return sendResponse(res, 403, null, true, error.message);
    }

    const user = await User.findOne({ email: value.email });
    if (user) {
      return sendResponse(res, 403, null, true, "User already exists");
    }

    const hashedPassword = await bcrypt.hash(value.password, 12);

    const getNextRollNo = async () => {
      const counter = await Counter.findOneAndUpdate(
        { id: "roll_no" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      return counter.seq;
    };

    const nextRollNo = await getNextRollNo();

    const newUser = new User({
      ...value,
      password: hashedPassword,
      roll_no: nextRollNo,
    });
    await newUser.save();

    // const newUser = new User({ ...value, password: hashedPassword });
    // await newUser.save();
    sendResponse(res, 201, newUser, false, "User is successfully registered");

    // await newUser.save();

    // Send email to admin after successful registration
    const emailSent = await sendMail(
      "Congratulations.! You have a New Registration in Al-Quran Institute Online",
      `<b>Name:</b> ${value.name}<br><b>Email:</b> ${value.email}<br><b>Phone:</b> ${value.phone}<br><b>Course:</b> ${value.course}<br><b>Country:</b> ${value.country}`
    );

    if (!emailSent) {
      console.warn("Email to admin failed to send, but user was registered.");
    }
  } catch (err) {
    sendResponse(
      res,
      500,
      null,
      true,
      "An unexpected error occurred" + err.message
    );
  }
});
router.post("/login", async (req, res) => {
  try {
    const { error, value } = loginschema.validate(req.body);
    if (error) {
      return sendResponse(res, 403, null, true, error.message);
    }

    const user = await User.findOne({ email: value.email }).lean();
    if (!user) {
      return sendResponse(res, 403, null, true, "User is not registered");
    }

    const isPasswordValid = await bcrypt.compare(value.password, user.password);
    if (!isPasswordValid) {
      return sendResponse(res, 403, null, true, "Invalid credentials");
    }

    const { password, ...userWithoutPassword } = user;
    const token = jwt.sign(userWithoutPassword, process.env.AUTH_SECRET, {
      expiresIn: "1d",
    });

    sendResponse(
      res,
      200,
      { user: userWithoutPassword, token },
      false,
      "User is successfully logged in"
    );
  } catch (err) {
    console.error("Error =>", err);
    sendResponse(res, 500, null, true, "An unexpected error occurred");
  }
});

export default router;
