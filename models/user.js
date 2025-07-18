import mongoose from "mongoose";

const { Schema } = mongoose;
const Registerschema = Schema(
  {
    name: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    email: { type: String, required: true, unique: true },
    gender: { type: String, trim: true, required: true },
    phone: { type: String },
    city: { type: String },
    country: { type: String },
    age: {
      type: Number,
      trim: true,
    },
    dob: {
      type: String,
      trim: true,
      required: true,
    },
    app: {
      type: String,
      trim: true,
      enum: ["WhatsApp", "Teams", "Google Meet", "Telegram", "Zoom"],
      required: true,
    },
    suitableTime: {
      type: String,
      trim: true,
    },
    days: {
      type: String,
    },
    course: {
      type: String,
      trim: true,
      enum: ["Qaida", "Tajweed", "Nazra", "Hifz", "Namaz", "Arabic"],
      required: true,
    },
    image: {
      type: String,
      default: "",
    },

    classDays: {
      type: [String],
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      default: undefined,
    },

    password: { type: String, trim: true, required: true },
    role: {
      type: String,
      trim: true,
      default: "Student",
      enum: ["Admin", "Student", "Teacher"],
    },
    // roll_no: {
    //   type: String,
    //   unique: true,
    // },
  },
  // console.log(req.body),
  {
    timestamps: true,
  }
);

const register = mongoose.model("register", Registerschema);

export default register;
