import express from "express";
import sendResponse from "../helper/sendResponse.js";
import Student from "../models/Students.js";
import authorization, { authenticateAdmin } from "../middlewares/authtication.js";


const router = express.Router();

router.get("/", authorization, async (req, res) => {
  const student = await Student.find();
  sendResponse(res, 200, student, false, "Student fateched Successfully");
});

router.post("/", authenticateAdmin, async (req, res) => {
  const student = new student(req.body);
  student = await student.save();
  sendResponse(res, 20, student, false, "Student added Successfully");
});

export default router;
