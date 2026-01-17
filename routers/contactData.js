import express from "express";
import sendResponse from "../helper/sendResponse.js";
import { Contact, ContactSchema } from "../models/contactSchema.js";
import cors from "cors";
import sendMail from "../utils/sendMail.js";
import "dotenv/config";

const app = express();
app.use(cors());

const contactRouter = express.Router();

contactRouter.post("/", async (req, res) => {
  try {
    const { error, value } = ContactSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return sendResponse(res, 400, null, true, errors.join(', '));
    }

    const existingContact = await Contact.findOne({ email: value.email });
    if (existingContact) {
      return sendResponse(res, 409, null, true, "Contact form already submitted with this email");
    }

    const newContact = new Contact(value);
    await newContact.save();

    // Send mail to admin
    const emailSent = await sendMail(
      "New Contact Form Submission - Al-Quran Institute Online",
      `<b>New Contact Form Submission:</b><br>
      <b>Name:</b> ${value.name}<br>
      <b>Email:</b> ${value.email}<br>
      <b>Phone:</b> ${value.phone}<br>
      <b>Subject:</b> ${value.subject}<br>
      <b>Message:</b> ${value.message}<br>
      <b>Submission Time:</b> ${new Date().toISOString()}`
    );

    if (!emailSent) {
      console.warn("Email to admin failed to send, but contact form was saved.");
    }

    sendResponse(
      res,
      201,
      newContact,
      false,
      "Contact form submitted successfully"
    );
  } catch (err) {
    console.error("Contact form error:", err);
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
