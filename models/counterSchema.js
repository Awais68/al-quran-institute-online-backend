import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true // Ensure each counter ID is unique
  }, // e.g., "roll_no"
  seq: {
    type: Number,
    default: 501
  },
}, {
  timestamps: true // Add timestamps for tracking when counters are updated
});

// No explicit index here: `unique: true` on `id` already builds the `id_1`
// index, and declaring it twice makes Mongoose log a duplicate-index warning.

const Counter = mongoose.model("Counter", counterSchema);

export default Counter;
