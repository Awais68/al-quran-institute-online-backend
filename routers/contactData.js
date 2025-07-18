import express from "express";
import sendResponse from "../helper/sendResponse.js";
import { Contact, ContactSchema } from "../models/contactSchema.js";
import nodemailer from "nodemailer";
import cors from "cors";
import sendMail from "../utils/sendMail.js";

const app = express();
app.use(cors());

const contactRouter = express.Router();

const ADMIN_EMAIL = "awaisniaz720@gmail.com"; // Admin email

// Function to send email to admin (if needed elsewhere)
const sendAdminEmail = async (userEmail) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "bfunter87@gmail.com",
        pass: "ppvssaxzxtqpvtum",
      },
    });

    const info = await transporter.sendMail({
      from: '"Al-Quran Institute Online"<codetheagent1@gmail.com>', // sender
      to: ADMIN_EMAIL, // only one 'to' property
      subject: "Successfull New User Registration",
      html: `<b>New user registered with email: ${userEmail}</b><br>
      <p>Registered at: ${new Date().toISOString()}</p>`,
    });

    console.log("Email sent to admin:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email to admin:", error);
    return false;
  }
};

contactRouter.post("/", async (req, res) => {
  try {
    const { error, value } = ContactSchema.validate(req.body);
    if (error) {
      return sendResponse(res, 400, null, true, error.message);
    }

    const existingContact = await Contact.findOne({ email: value.email });
    if (existingContact) {
      return sendResponse(res, 409, null, true, "User already exists");
    }

    const newContact = new Contact(value);
    await newContact.save();

    // Send mail to admin
    await sendMail(
      "New Contact Form Submission",
      `<b>Name:</b> ${value.name}<br><b>Email:</b> ${value.email}<br><b>Phone:</b> ${value.phone}<br><b>Subject:</b> ${value.subject}<br><b>Message:</b> ${value.message}`
    );

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
