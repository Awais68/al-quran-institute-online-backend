import express from "express";
import sendResponse from "../helper/sendResponse.js";
import User from "../models/user.js";
import authorization from "../middlewares/authtication.js";

const router = express.Router();

router.get("/currentStudent", authorization, async (req, res) => {
  try {
    const student = await User.findById(req.user._id).select("-password");
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

router.get("/getCurrentUser", authorization, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).select("-password");
    if (!currentUser) {
      return sendResponse(res, 404, null, true, "User not found");
    }
    sendResponse(res, 200, currentUser, false, "Fetched Data Successfully");
  } catch (error) {
    console.error("Error fetching current user:", error);
    sendResponse(res, 500, null, true, "Error fetching user data: " + error.message);
  }
});

export default router;
