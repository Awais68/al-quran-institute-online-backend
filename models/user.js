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
    course: {
      type: String,
      trim: true,
      enum: ["qaida", "tajweed", "nazra", "hifz"],
      required: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
      default:
        "https://console.cloudinary.com/app/c-a9c666dc11a39ce91bc16c14702c32/assets/media_library/search/asset/280b4767e22d530326165f212e055620/manage/summary?q=&view_mode=mosaic&context=manage",
    },

    // classDays: {
    //   type: String,
    //   required: true,
    //   days: [
    //     "Monday",
    //     "Tuesday",
    //     "Wednesday",
    //     "Thursday",
    //     "Friday",
    //     "Saturday",
    //     "Sunday",
    //   ],
    // },

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

// address: { type: String },
// DOB: { type: String },
// city: { type: String, trim: true },
// country: { type: String, trim: true },
