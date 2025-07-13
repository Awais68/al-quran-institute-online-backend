import express from "express";
import sendResponse from "../helper/sendResponse.js";
// import Student from "../models/Students.js";
import authorization from "../middlewares/authtication.js";
import register from "../models/user.js";

const router = express.Router();

router.get("/getAllStudents", async (req, res) => {
  try {
    const student = await register.find();
    sendResponse(res, 200, student, false, "Student fateched Successfully");
  } catch (error) {
    sendResponse(res, 400, null, true, "Something Went Wrong" + error.message);
  }
});

// router.post("/", authenticateAdmin, async (req, res) => {
//   const student = new student(req.body);
//   student = await student.save();
//   sendResponse(res, 20, student, false, "Student added Successfully");
// });

export default router;
