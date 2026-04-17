import express from "express";
import sendResponse from "../helper/sendResponse.js";
import register from "../models/user.js";
import authenticate from "../middlewares/authtication.js";
import { verifyToken } from "../middlewares/verifyToken.js";


const StudentByIdRouter = express.Router();

// Make sure you import the middleware

StudentByIdRouter.get("/getAStudent/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const student = await register.findById(id);

    // if (!mongoose.Types.ObjectId.isValid(id)) {
    //   return sendResponse(res, 400, null, true, "Invalid Student ID");
    // }

    // const student = await register.findById(id);

    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }

    sendResponse(res, 200, student, false, "Student fetched successfully");
  } catch (error) {
    sendResponse(
      res,
      500,
      null,
      true,
      "Something went wrong: " + error.message
    );
  }
});

// Naya route: current login student ke liye
StudentByIdRouter.get("/getCurrentStudent", authenticate, async (req, res) => {
  try {
    const student = req.user; // Now user object is already attached
    if (!student) {
      return sendResponse(res, 404, null, true, "Student not found");
    }
    sendResponse(res, 200, student, false, "Fetched Data Successfully");
  } catch (error) {
    sendResponse(
      res,
      400,
      null,
      true,
      "Something went wrong: " + error.message
    );
  }
});

export default StudentByIdRouter;
