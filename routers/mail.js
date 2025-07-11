import express from "express";
import nodemailer from "nodemailer";

const app = express();
const port = 4000;

const ADMIN_EMAIL = "awaisniaz720@gmail.com"; // ← isay apni admin wali email se replace kar lena
const mailRouter = express.Router();

mailRouter.get("/send-email/:email", async (req, res) => {
  const email = req.params.email;

  const transporter = nodemailer.createTransport({
    service: "gmail", // ya smtp service jo use karni ho
    // host: "smtp.gmail.com",
    // port: 465,
    // secure: true,
    auth: {
      user: "bfunter87@gmail.com",
      pass: "ppvssaxzxtqpvtum",
    },
  });

  const info = await transporter.sendMail({
    from: '"Al-Quran Institute Online"<codetheagent1@gmail.com>', // sender
    to: "awaisniaz720@gmail.com", // admin
    to: "bfunter87@gmail.com", // admin
    to: "muzammilshaikh7077@gmail.com", // admin
    to: "hamzajii768@gmail.com", // admin
    to: "owaisniaz596@gmail.com", // admin
    subject: "Sending emails to user and admin ",
    // text: "hello World",
    html: "<b>Well Come Back Guys</b>",
    html: "<b>One New Signup User in your WebSite </b>",
  });
  console.log("message.sent", info.messageId);
  res.send("Email sent");
});

export default mailRouter;
