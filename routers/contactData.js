import express from "express";
import sendResponse from "../helper/sendResponse.js";
import { Contact, ContactSchema } from "../models/contactSchema.js";
// import sendMail from "../utils/sendMail.js";

const contactRouter = express.Router();

contactRouter.post("/", async (req, res) => {
  try {
    const { error, value } = ContactSchema.validate(req.body);
    if (error) {
      return sendResponse(res, 403, null, true, error.message);
    }

    const existingContact = await Contact.findOne({ email: value.email });
    if (existingContact) {
      return sendResponse(res, 403, null, true, "User already exists");
    }

    const newContact = new Contact(value);
    await newContact.save();
    sendMail(subject, message);
    sendResponse(
      res,
      201,
      newContact,
      false,
      "User's message received successfully"
    );
  } catch (err) {
    console.log("contact failed:", err.message);

    sendResponse(
      res,
      500,
      null,
      true,
      "An unexpected error occurred: " + err.message
    );
  }
});

export default contactRouter;
