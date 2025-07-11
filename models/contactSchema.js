import mongoose from "mongoose";
import Joi from "joi";

// Mongoose Schema
const { Schema } = mongoose;
const ContactSchemaMongoose = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    subject: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const Contact = mongoose.model("Contact", ContactSchemaMongoose);

// Joi Validation Schema
export const ContactSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
  message: Joi.string().required(),
  subject: Joi.string().required(),
});

export { Contact };
