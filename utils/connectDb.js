import mongoose from "mongoose";
import "dotenv/config";

const connectToDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log("Database is connected successfully.");

    // Log connection events for debugging
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    process.exit(1); // Exit the process with failure
  }
};

export default connectToDB;
