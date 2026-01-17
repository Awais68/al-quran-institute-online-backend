import mongoose from "mongoose";

const { Schema } = mongoose;

const AchievementSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    achievementId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["attendance", "performance", "milestone", "special"],
      required: true,
    },
    unlocked: {
      type: Boolean,
      default: false,
    },
    unlockedDate: {
      type: Date,
    },
    criteria: {
      attendance: Number,
      lessonsCompleted: Number,
      teacherRating: Number,
      daysStreak: Number,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

// Create compound index for studentId and achievementId
AchievementSchema.index({ studentId: 1, achievementId: 1 }, { unique: true });

const Achievement = mongoose.model("Achievement", AchievementSchema);

export default Achievement;
