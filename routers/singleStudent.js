import express from "express";
import sendResponse from "../helper/sendResponse.js";
import register from "../models/user.js";

const StudentByIdRouter = express.Router();

StudentByIdRouter.get("/getAStudent/:id", async (req, res) => {
  try {
    const { id } = req.params; // ❌ You had: const { id } = req.params.id;

    const student = await register.findById(id);

    // Optionally, you can check if student was found
    // if (!student) {
    //   return sendResponse(res, 404, null, true, "Student not found");
    // }

    sendResponse(res, 200, student, false, "Student fetched successfully");
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
