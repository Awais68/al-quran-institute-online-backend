import express from "express";
import sendResponse from "../helper/sendResponse.js";
import Joi from "joi";
import User from "../models/user.js";
import "dotenv/config";
import jwt from "jsonwebtoken";
import cors from "cors";
import authorization from "../middlewares/authtication.js";



const app = express();
app.use(cors());
const router = express.Router();


// console.log(req.body)
const loginschema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
    .required(),
  password: Joi.string().min(3).required(),
});





router.get("/currentStudent", authorization, async (req, res) => {
  try {
    const student = await User.findById(req.user._id);
    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }
    sendResponse(
      res,
      200,
      student,
      false,
      "Current student fetched successfully"
    );
  } catch (error) {
    sendResponse(
      res,
      400,
      null,
      true,
      "Something Went Wrong: " + error.message
    );
  }
});


router.get("/getCurrentUser", authorization, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id).select(
      "-password"
    );
    sendResponse(res, 200, currentUser, false, "Fetched Data Successfully");
  } catch (error) {
    sendResponse(res, 500, null, true, "xxxxxxxxxxxxxx");
  }
})

export default router;

