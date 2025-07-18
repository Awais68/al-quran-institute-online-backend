import nodemailer from "nodemailer";

const sendMail = async (subject, message, to = "awaisniaz720@gmail.com") => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "bfunter87@gmail.com", // apna email
        pass: "ppvssaxzxtqpvtum", // apna app password
      },
    });

    const info = await transporter.sendMail({
      from: '"Al-Quran Institute Online"<bfunter87@gmail.com>',
      to,
      subject,
      html: message,
    });

    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

export default sendMail;
