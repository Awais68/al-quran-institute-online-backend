import mongoose from "mongoose";

const { Schema } = mongoose;

const Registerschema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Name is required'],
      minlength: [3, 'Name must be at least 3 characters long'],
      maxlength: [30, 'Name cannot exceed 30 characters']
    },
    fatherName: {
      type: String,
      trim: true,
      required: function() {
        return this.role === 'Student';
      },
      minlength: [3, 'Father name must be at least 3 characters long'],
      maxlength: [30, 'Father name cannot exceed 30 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
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
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      minlength: [10, 'Phone number must be at least 10 digits'],
      maxlength: [15, 'Phone number cannot exceed 15 digits']
    },
    city: { type: String, trim: true },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true
    },
    age: {
      type: Number,
      trim: true,
      required: function() {
        return this.role === 'Student';
      },
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age cannot exceed 120']
    },
    dob: {
      type: String,
      trim: true,
      required: function() {
        return this.role === 'Student';
      }
    },
    app: {
      type: String,
      trim: true,
      enum: {
        values: ["WhatsApp", "Teams", "Google Meet", "Telegram", "Zoom"],
        message: 'Application must be one of WhatsApp, Teams, Google Meet, Telegram, or Zoom'
      },
      required: function() {
        return this.role === 'Student';
      }
    },
    suitableTime: {
      type: String,
      trim: true
    },
    days: {
      type: String,
    },
    course: {
      type: String,
      trim: true,
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
        message: 'Course must be one of the available courses'
      },
      required: function() {
        return this.role === 'Student';
      }
    },
    image: {
      type: String,
      default: "",
    },

    classDays: {
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
        message: 'Class days must be valid days of the week'
      },
      default: undefined,
    },

    // Teacher-specific fields
    qualification: {
      type: String,
      trim: true,
      required: function() {
        return this.role === 'Teacher';
      }
    },
    experience: {
      type: String,
      trim: true,
      required: function() {
        return this.role === 'Teacher';
      }
    },
    expertise: {
      type: String,
      trim: true,
      required: function() {
        return this.role === 'Teacher';
      }
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },

    password: {
      type: String,
      trim: true,
      required: [true, 'Password is required'],
      select: false // Don't return password by default
    },
    role: {
      type: String,
      trim: true,
      default: "Student",
      enum: {
        values: ["Admin", "Student", "Teacher"],
        message: 'Role must be Admin, Student, or Teacher'
      }
    },
    roll_no: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple documents without this field
      required: false,
      default: undefined // Don't set to null, leave undefined
    },
    teacherInstructions: {
      type: String,
      trim: true,
      default: ""
    },
    adminNotes: {
      type: String,
      trim: true,
      default: ""
    },
    fees: {
      type: Number,
      default: 0,
      min: [0, 'Fees cannot be negative']
    },
    feeStatus: {
      type: String,
      enum: {
        values: ['paid', 'unpaid', 'partial'],
        message: 'Fee status must be paid, unpaid, or partial'
      },
      default: 'unpaid'
    },
    feesPaid: {
      type: Boolean,
      default: false
    },
    totalFeePaid: {
      type: Number,
      default: 0,
      min: [0, 'Total fee paid cannot be negative']
    },
    feeHistory: [{
      amount: {
        type: Number,
        required: true,
        min: [0, 'Payment amount cannot be negative']
      },
      paymentDate: {
        type: Date,
        default: Date.now
      },
      paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'online', 'cheque'],
        default: 'cash'
      },
      receiptNumber: {
        type: String,
        unique: true,
        sparse: true
      },
      notes: {
        type: String,
        trim: true
      },
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['confirmed', 'pending', 'cancelled'],
        default: 'confirmed'
      }
    }],
    nextPaymentDue: {
      type: Date
    },
    assignedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'pending'],
        message: 'Status must be active, inactive, or pending'
      },
      default: 'pending'
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
  },

  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields (email and feeHistory.receiptNumber already have unique in schema)
Registerschema.index({ role: 1 });
Registerschema.index({ course: 1 });
Registerschema.index({ createdAt: 1 });
Registerschema.index({ feeStatus: 1 });
Registerschema.index({ status: 1 });

const User = mongoose.model("User", Registerschema);

export default User;
