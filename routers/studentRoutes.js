import express from "express";
import sendResponse from "../helper/sendResponse.js";
import User from "../models/user.js"; // Changed from 'register' to 'User' for consistency
import authenticate from "../middlewares/authentication.js"; // Fixed import path
import { verifyToken } from "../middlewares/verifyToken.js";
import mongoose from "mongoose";

const StudentByIdRouter = express.Router();

// Route to get a specific student by ID (requires token verification)
StudentByIdRouter.get("/getAStudent/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, null, true, "Invalid Student ID format");
    }

    const student = await User.findById(id);

    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }

    // Remove sensitive information before sending
    const studentData = {
      _id: student._id,
      name: student.name,
      fatherName: student.fatherName,
      email: student.email,
      phone: student.phone,
      age: student.age,
      gender: student.gender,
      country: student.country,
      city: student.city,
      course: student.course,
      suitableTime: student.suitableTime,
      app: student.app,
      dob: student.dob,
      image: student.image,
      role: student.role,
      roll_no: student.roll_no,
    };

    sendResponse(res, 200, studentData, false, "Student fetched successfully");
  } catch (error) {
    console.error("Error fetching student:", error);
    sendResponse(
      res,
      500,
      null,
      true,
      "Something went wrong: " + error.message
    );
  }
});

// Route to get current logged-in student
StudentByIdRouter.get("/getCurrentStudent", authenticate, async (req, res) => {
  try {
    const student = req.user;

    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }

    // Remove sensitive information
    const studentData = {
      _id: student._id,
      name: student.name,
      fatherName: student.fatherName,
      email: student.email,
      phone: student.phone,
      age: student.age,
      gender: student.gender,
      country: student.country,
      city: student.city,
      course: student.course,
      suitableTime: student.suitableTime,
      app: student.app,
      dob: student.dob,
      image: student.image,
      role: student.role,
      roll_no: student.roll_no,
    };

    sendResponse(
      res,
      200,
      studentData,
      false,
      "Current student data fetched successfully"
    );
  } catch (error) {
    console.error("Error fetching current student:", error);
    sendResponse(
      res,
      500,
      null,
      true,
      "Something went wrong: " + error.message
    );
  }
});

export default StudentByIdRouter;
