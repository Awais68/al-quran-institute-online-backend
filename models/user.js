import mongoose from "mongoose";

const { Schema } = mongoose;
const UserSchema = Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    age: {
      type: String,
      trim: true,
      enum: ["child", "teen", "adult"],
      required: true
    },    
    // age: { type: String, trim: true, enum: ["child", "teen", "adult"] },
    currentLevel: {
      type: String,
      trim: true,
      enum: ["beginner", "intermediate", "advance"],
    },

    password: { type: String, trim: true, required: true },
    // confirmPassword: { type: String, required: true, trim: true },
  },
  // console.log(req.body),
  {
    timestamps: true,
  }
);

const User = mongoose.model("users", UserSchema);

export default User;

// address: { type: String },
// DOB: { type: String },
// city: { type: String, trim: true },
// country: { type: String, trim: true },
