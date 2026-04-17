import mongoose from "mongoose";

const { Schema } = mongoose;

const TeacherSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Name is required'],
      minlength: [3, 'Name must be at least 3 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      minlength: [10, 'Phone number must be at least 10 digits'],
      maxlength: [15, 'Phone number cannot exceed 15 digits']
    },
    gender: {
      type: String,
      trim: true,
      required: [true, 'Gender is required'],
      enum: {
        values: ['male', 'female', 'other'],
        message: 'Gender must be male, female, or other'
      }
    },
    specialization: {
      type: [String],
      enum: {
        values: [
          "Qaida",
          "Tajweed",
          "Nazra",
          "Hifz",
          "Namaz",
          "Arabic",
          "Islamic Studies"
        ],
        message: 'Specialization must be one of the available courses'
      },
      required: [true, 'At least one specialization is required']
    },
    experience: {
      type: Number,
      min: [0, 'Experience cannot be negative'],
      default: 0
    },
    qualification: {
      type: String,
      trim: true,
      maxlength: [200, 'Qualification cannot exceed 200 characters']
    },
    image: {
      type: String,
      default: "",
    },
    availability: {
      type: [String],
      enum: {
        values: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        message: 'Availability days must be valid days of the week'
      },
      default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
    assignedStudents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'on-leave'],
        message: 'Status must be active, inactive, or on-leave'
      },
      default: 'active'
    },
    joinDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
TeacherSchema.index({ email: 1 });
TeacherSchema.index({ status: 1 });
TeacherSchema.index({ specialization: 1 });
TeacherSchema.index({ createdAt: 1 });

const Teacher = mongoose.model("Teacher", TeacherSchema);

export default Teacher;
