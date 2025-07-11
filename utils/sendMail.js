// // import express from "express";
// // import nodemailer from "nodemailer";
// // const app = express();
// // const port = 4000;
// // // In auth.js
// // // import sendMail from '../utilis/sendMail.js'; // Relative path from routers to utilis

// // // admin ki email
// // const ADMIN_EMAIL = "awaisniaz720@gmail.com"; // ← isay apni admin wali email se replace kar lena

// // app.get("/send-email/:email", async (req, res)=> {

// //   const email = req.params.email;

// //     const transporter = nodemailer.createTransport({
// //       service: "gmail", // ya smtp service jo use karni ho
// //       // host: "smtp.gmail.com",
// //       // port: 465,
// //       // secure: true,
// //       auth: {
// //         user: process.env.EMAIL_USER,
// //         pass: process.env.EMAIL_PASS,
// //       },
// //     });

// //     const info = await transporter.sendMail({
// //       from: '"Code the Agent "<bfunter87@gmail.com>', // sender
// //       to: "awaisniaz720@gmail.com", // admin
// //       subject: "use nodemailer for sending emails to user and admin ",
// //       // text: "hello World",
// //       html: "<b>Fuck the shit </b>",
// //     });
// //     console.log("message.sent", info.messageId);
// //     res.send("Email sent");

// // })

// // export default sendMail;

// import nodemailer from "nodemailer";
// import express from "express";
// const app = express();
// const port = 4000;

// const ADMIN_EMAIL = "awaisniaz720@gmail.com"; // ← isay apni admin wali email se replace kar lena

// app.get("/send-email/:email", async (req, res) => {
//   const email = req.params.email;

//   const transporter = nodemailer.createTransport({
//     service: "gmail", // ya smtp service jo use karni ho
//     // host: "smtp.gmail.com",
//     // port: 465,
//     // secure: true,
//     auth: {
//       user: "bfunter87@gmail.com",
//       pass: "ppvssaxzxtqpvtum",
//     },
//   });

//   const info = await transporter.sendMail({
//     from: '"Code the Agent "<bfunter87@gmail.com>', // sender
//     to: "awaisniaz720@gmail.com", // admin
//     subject: "use nodemailer for sending emails to user and admin ",
//     // text: "hello World",
//     html: "<b>Fuck the shit </b>",
//   });
//   console.log("message.sent", info.messageId);
//   res.send("Email sent");
// });

// export default SendMail;
