import mongoose from "mongoose";

const { Schema } = mongoose;

const LessonSchema = new Schema(
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
    courseId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    rules: {
      type: String,
      trim: true,
    },
    teacherNotes: {
      type: String,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    repeated: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["upcoming", "completed"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);

const Lesson = mongoose.model("Lesson", LessonSchema);

export default Lesson;
