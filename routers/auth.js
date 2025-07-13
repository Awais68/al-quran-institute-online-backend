import express from "express";
import bcrypt from "bcrypt";
import sendResponse from "../helper/sendResponse.js";
import Joi from "joi";
import User from "../models/user.js";
import "dotenv/config";
import jwt from "jsonwebtoken";
import cors from "cors";
import nodemailer from "nodemailer";
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
  app: Joi.string().valid("whatsApp", "teams", "googleMeet", "telegram"),
  suitableTime: Joi.string().valid(),
  // days: Joi.string(),
  suitableTime: Joi.string().valid(),
  course: Joi.string().valid(
    "qaida",
    "tajweed",
    "nazra",
    "hifz",
    "namaz",
    "arabic"
  ),
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
// console.log(req.body)
const loginschema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
    .required(),
  password: Joi.string().min(3).required(),
});

const ADMIN_EMAIL = "awaisniaz720@gmail.com"; // Admin email

// Function to send email to admin
const sendAdminEmail = async (userEmail) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "bfunter87@gmail.com",
        pass: "ppvssaxzxtqpvtum",
      },
    });

    const info = await transporter.sendMail({
      from: '"Al-Quran Institute Online"<codetheagent1@gmail.com>', // sender
      to: ADMIN_EMAIL,
      to: "awaisniaz720@gmail.com", // admin
      to: "bfunter87@gmail.com", // admin
      // to: "muzammilshaikh7077@gmail.com", // admin
      // to: "hamzajii768@gmail.com", // admin
      // to: "owaisniaz596@gmail.com", // admin
      subject: "Successfull New User Registration",
      // text: "hello World",
      // html: "<b>Well Come Back Guys</b>",
      // html: "<b>One New Signup User in your WebSite </b>",
      html: `<b>New user registered with email: ${userEmail}</b><br>
      <p>Registered at: ${new Date().toISOString()}</p>`,
    });
    //  <p>Name: ${userData.name}</p>
    //  <p>Course: ${userData.course}</p>

    console.log("Email sent to admin:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email to admin:", error);
    return false;
  }
};

router.post("/signup", async (req, res) => {
  try {
    const { error, value } = Registerschema.validate(req.body);
    if (error) {
      return sendResponse(res, 403, null, true, error.message);
      console.log("error is here====>>>>>>", error.details[0].message);
    }

    const user = await User.findOne({ email: value.email });
    if (user) {
      return sendResponse(res, 403, null, true, "User already exists");
    }

    const hashedPassword = await bcrypt.hash(value.password, 12);
    const newUser = new User({ ...value, password: hashedPassword });
    await newUser.save();
    sendResponse(res, 201, newUser, false, "User is successfully registered");

    // Send email to admin after successful registration
    const emailSent = await sendAdminEmail(value.email);
    if (!emailSent) {
      console.warn("Email to admin failed to send, but user was registered.");
    }
  } catch (err) {
    console.log("Signup failed:", err.response?.data?.message);

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
