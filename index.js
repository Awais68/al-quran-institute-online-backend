import express from "express";
import morgan from "morgan";
import authRoutes from "./routers/auth.js";
import connectDB from "./utils/connectDb.js";
// import contactFormRoutes from "./routers/contactData.js";
import cors from "cors";
import contactRouter from "./routers/contactData.js";
import StudentByIdRouter from "./routers/singleStudent.js";
import mailRouter from "./routers/mail.js";
import userRoutes from "./routers/user.js";
import currentStudRouter from "./routers/currentStud.js";
const app = express();
const PORT = 4000; // 0 means OS will assign a free port

app.use(cors());
app.use(morgan("tiny"));
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use("/auth", authRoutes);
app.use("/signup", authRoutes);
app.use("/login", authRoutes);
app.use("/user", userRoutes);
app.use("/contactForm", contactRouter);
app.use("/studentById", StudentByIdRouter);
app.use("/", mailRouter);
app.use("/", currentStudRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
