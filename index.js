import express from "express";
import morgan from "morgan";
import connectToDB from "./utilis/connectDb.js";
import authRoutes from "./routers/auth.js";
import userRoutes from "./routers/user.js";
import cors from "cors";

const app = express();
const PORT = 4000;
app.use(cors());
app.use(morgan("tiny"));
app.use(express.json());

connectToDB();

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use("/auth", authRoutes);
app.use("/signup", authRoutes);
app.use("/login", authRoutes);
app.use("/user", userRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
