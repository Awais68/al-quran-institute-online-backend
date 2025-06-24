import express from "express";
import bcrypt from "bcrypt";
import sendResponse from "../helper/sendResponse.js";
import Joi from "joi";
import User from "../models/user.js";
import "dotenv/config";
import jwt from "jsonwebtoken";
import cors from "cors";
// import authorization from "../middlewares/authtication.js";

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
  city: Joi.string().required(),
  country: Joi.string().required(),

  // dob: Joi.string().valid().required(),
  app: Joi.string().valid("whatsApp", "teams", "googleMeet", "telegram"),
  suitableTime: Joi.string().valid(),
  // days: Joi.string(),
  course: Joi.string().valid("qaida", "tajweed", "nazra", "hifz"),
  password: Joi.string().min(8).required(),
});
// console.log(req.body)
const loginschema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
    .required(),
  password: Joi.string().min(3).required(),
});
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
