import mongoose from "mongoose";

const { Schema } = mongoose;

const ActivitySchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["remark", "submission", "feedback"],
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    content: {
      type: String,
      required: true,
    },
    media: {
      type: {
        type: String,
        enum: ["audio", "video"],
      },
      url: String,
      cloudinaryId: String,
      thumbnail: String,
    },
    teacherFeedback: {
      type: String,
    },
    teacherName: {
      type: String,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["pending", "reviewed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Activity = mongoose.model("Activity", ActivitySchema);

export default Activity;
