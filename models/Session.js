import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: String,
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    duration: {
      type: Number, // in minutes
      default: 60,
    },
    topic: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "ongoing"],
      default: "scheduled",
    },
    notes: {
      type: String,
      trim: true,
    },
    teacherNotes: {
      type: String,
      trim: true,
    },
    meetingLink: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
sessionSchema.index({ studentId: 1, scheduledDate: -1 });
sessionSchema.index({ teacherId: 1, scheduledDate: -1 });
sessionSchema.index({ status: 1, scheduledDate: 1 });

const Session = mongoose.model("Session", sessionSchema);

export default Session;
