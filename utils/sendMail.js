import nodemailer from "nodemailer";

const sendMail = async (subject, message, to = "aqionline786@gmail.com") => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "aqionline786@gmail.com", // apna email
        pass: "cics roat rbyp viau", // apna app password
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
