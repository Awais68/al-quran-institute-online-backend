import nodemailer from "nodemailer";
import "dotenv/config";

const sendMail = async (subject, message, to = process.env.EMAIL_ADMIN || "aqionline786@gmail.com") => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_SERVICE_USER,
        pass: process.env.EMAIL_SERVICE_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: '"Al-Quran Institute Online"<aqionline786@gmail.com>',
      to,
      subject,
      html: message,
    });

    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

export default sendMail;
