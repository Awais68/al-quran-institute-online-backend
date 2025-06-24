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
    // dob: {
    //   type: String,
    //   trim: true,
    //   required: true,
    // },
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
      enum: ["qaida", "tajweed", "nazra", "hifz"],
      required: true,
    },

    password: { type: String, trim: true, required: true },
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
