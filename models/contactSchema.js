import mongoose from "mongoose";
import Joi from "joi";

// Mongoose Schema
const { Schema } = mongoose;
const ContactSchemaMongoose = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Name is required'],
      minlength: [2, 'Name must be at least 2 characters long'],
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
      required: [true, 'Phone is required'],
      trim: true,
      minlength: [10, 'Phone number must be at least 10 digits'],
      maxlength: [15, 'Phone number cannot exceed 15 digits']
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      minlength: [10, 'Message must be at least 10 characters long'],
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      minlength: [5, 'Subject must be at least 5 characters long'],
      maxlength: [100, 'Subject cannot exceed 100 characters']
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
ContactSchemaMongoose.index({ email: 1 });
ContactSchemaMongoose.index({ createdAt: 1 });

const Contact = mongoose.model("Contact", ContactSchemaMongoose);

// Joi Validation Schema
export const ContactSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  phone: Joi.string().min(10).max(15).required().messages({
    'string.min': 'Phone number must be at least 10 digits',
    'string.max': 'Phone number cannot exceed 15 digits',
    'any.required': 'Phone number is required'
  }),
  message: Joi.string().min(10).max(1000).required().messages({
    'string.min': 'Message must be at least 10 characters long',
    'string.max': 'Message cannot exceed 1000 characters',
    'any.required': 'Message is required'
  }),
  subject: Joi.string().min(5).max(100).required().messages({
    'string.min': 'Subject must be at least 5 characters long',
    'string.max': 'Subject cannot exceed 100 characters',
    'any.required': 'Subject is required'
  }),
});

export { Contact };
