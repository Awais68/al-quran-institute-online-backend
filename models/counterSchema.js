import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  id: { type: String, required: true }, // e.g., "roll_no"
  seq: { type: Number, default: 501 },
});

const Counter = mongoose.model("counter", counterSchema);

export default Counter;
