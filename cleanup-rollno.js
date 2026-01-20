import mongoose from 'mongoose';
import connectDB from './utils/connectDb.js';

async function cleanupNullRollNo() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('✓ Connected to database\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find all users with null roll_no
    console.log('Finding users with null roll_no...');
    const usersWithNull = await usersCollection.find({ roll_no: null }).toArray();
    console.log(`Found ${usersWithNull.length} users with null roll_no`);

    if (usersWithNull.length > 0) {
      console.log('\nUsers:', usersWithNull.map(u => ({ name: u.name, email: u.email })));
      
      // Remove roll_no field from all users (set to undefined instead of null)
      console.log('\nRemoving roll_no field from all these users...');
      const result = await usersCollection.updateMany(
        { roll_no: null },
        { $unset: { roll_no: "" } }
      );
      console.log(`✓ Updated ${result.modifiedCount} users`);
    }

    // Also check for users where roll_no exists but is undefined
    const usersWithUndefined = await usersCollection.find({ roll_no: { $exists: true, $eq: null } }).toArray();
    console.log(`\nFound ${usersWithUndefined.length} users with undefined roll_no`);

    console.log('\n✅ Cleanup complete!');
    console.log('Try registering a new user now.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Connection closed');
    process.exit(0);
  }
}

cleanupNullRollNo();
