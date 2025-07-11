import express from "express";
import sendResponse from "../helper/sendResponse.js";
import authorization from "../middlewares/authtication.js";
import User from "../models/user.js";

const userRoutes = express.Router();

userRoutes.get("/student", authorization, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.user._id,
    });
    sendResponse(res, 201, User, false, "User Get Successfully");
  } catch (err) {
    sendResponse(res, 500, null, true, "Something went wrong");
  }
});

userRoutes.put("/updateUser", authorization, async (req, res) => {
  try {
    const { phone, address, DOB, city, country } = req.body;

    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { phone, address, DOB, city, country },
      { new: true }
    ).exec();

    if (!user) {
      return sendResponse(res, 404, null, true, "User not found");
    }

    sendResponse(res, 200, user, false, "User updated successfully");
  } catch (err) {
    sendResponse(res, 500, null, true, err.message);
  }
});

userRoutes.get("/getUser", async (req, res) => {
  try {
    const user = await User.find();
    sendResponse(res, 200, user, false, "Users fetched successfully");
  } catch (err) {
    sendResponse(res, 500, null, true, err.message);
  }
});

export default userRoutes;
