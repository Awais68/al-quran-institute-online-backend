import mongoose from 'mongoose';
import connectDB from './utils/connectDb.js';

async function recreateRollNoIndex() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('✓ Connected to database\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('Dropping roll_no index if exists...');
    try {
      await usersCollection.dropIndex('roll_no_1');
      console.log('✓ Dropped roll_no_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('Index does not exist, skipping drop');
      } else {
        throw error;
      }
    }

    console.log('\nCreating new sparse unique index on roll_no...');
    await usersCollection.createIndex(
      { roll_no: 1 },
      { 
        unique: true, 
        sparse: true,
        background: true,
        name: 'roll_no_1'
      }
    );
    console.log('✓ Created sparse unique index on roll_no');

    console.log('\nVerifying index...');
    const indexes = await usersCollection.indexes();
    const rollNoIndex = indexes.find(idx => idx.name === 'roll_no_1');
    
    if (rollNoIndex && rollNoIndex.sparse === true) {
      console.log('✅ Success! roll_no index is now properly configured');
      console.log('   Index details:', JSON.stringify(rollNoIndex, null, 2));
      console.log('\n✓ You can now register multiple users without roll_no');
    } else {
      console.log('⚠️  Warning: Index may not be properly configured');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Connection closed');
    process.exit(0);
  }
}

recreateRollNoIndex();
