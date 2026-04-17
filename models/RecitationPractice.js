import mongoose from "mongoose";

const { Schema } = mongoose;

const RecitationPracticeSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    cloudinaryId: {
      type: String,
    },
    addedBy: {
      type: String,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const RecitationPractice = mongoose.model("RecitationPractice", RecitationPracticeSchema);

export default RecitationPractice;
