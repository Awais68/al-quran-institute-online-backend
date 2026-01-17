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

// Add index for the id field for faster lookups
counterSchema.index({ id: 1 });

const Counter = mongoose.model("Counter", counterSchema);

export default Counter;
