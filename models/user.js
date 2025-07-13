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
      enum: ["whatsApp", "teams", "googleMeet", "telegram"],
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
      enum: ["qaida", "tajweed", "nazra", "hifz", "namaz", "arabic"],
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
  },
  // console.log(req.body),
  {
    timestamps: true,
  }
);

const register = mongoose.model("register", Registerschema);

export default register;
