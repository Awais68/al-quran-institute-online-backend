import mongoose from 'mongoose';
import connectDB from './utils/connectDb.js';
import User from './models/user.js';

async function fixDuplicateRollNo() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('✓ Connected to database\n');

    // Find all users with null roll_no
    const usersWithNullRollNo = await User.find({ roll_no: null });
    console.log(`Found ${usersWithNullRollNo.length} users with null roll_no`);

    if (usersWithNullRollNo.length <= 1) {
      console.log('✓ No duplicates found. Database is clean.');
      process.exit(0);
    }

    // Keep the first one, remove roll_no field from others
    console.log(`\nRemoving roll_no field from ${usersWithNullRollNo.length - 1} users...`);
    
    for (let i = 1; i < usersWithNullRollNo.length; i++) {
      const user = usersWithNullRollNo[i];
      await User.updateOne(
        { _id: user._id },
        { $unset: { roll_no: "" } }
      );
      console.log(`✓ Updated user: ${user.name} (${user.email})`);
    }

    console.log('\n✅ Successfully cleaned up duplicate roll_no entries');
    console.log('You can now register new users without errors');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Connection closed');
    process.exit(0);
  }
}

fixDuplicateRollNo();
