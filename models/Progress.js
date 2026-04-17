import mongoose from "mongoose";

const { Schema } = mongoose;

const ProgressSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    overall: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    attendance: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    recitation: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    memorization: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    tajweed: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    teacherFeedback: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        remarks: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
          required: true,
        },
        improvements: [{
          type: String,
        }],
        teacherName: {
          type: String,
          required: true,
        },
        teacherId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  { timestamps: true }
);

const Progress = mongoose.model("Progress", ProgressSchema);

export default Progress;
