import express from "express";
import nodemailer from "nodemailer";
import "dotenv/config";

const app = express();
const mailRouter = express.Router();

mailRouter.get("/send-email/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_SERVICE_USER,
        pass: process.env.EMAIL_SERVICE_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: '"Al-Quran Institute Online"<aqionline786@gmail.com>', // sender
      to: process.env.EMAIL_ADMIN || "aqionline786@gmail.com", // admin
      subject: "New User Signup Notification",
      html: `<b>New User Signup:</b><br>
             <p>Email: ${email}</p>
             <p>Time: ${new Date().toISOString()}</p>`,
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully"
    });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email"
    });
  }
});

export default mailRouter;
