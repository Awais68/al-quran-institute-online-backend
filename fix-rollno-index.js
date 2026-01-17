/**
 * Fix duplicate key error for roll_no field
 * This script drops the old non-sparse index and creates a new sparse index
 * that allows multiple null values
 */

import mongoose from 'mongoose';
import connectDb from './utils/connectDb.js';

async function fixRollNoIndex() {
  try {
    // Connect to database
    await connectDb();
    console.log('✓ Connected to database');

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Check existing indexes
    console.log('\nChecking existing indexes...');
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    // Find the roll_no index
    const rollNoIndex = indexes.find(idx => idx.key && idx.key.roll_no);
    
    if (rollNoIndex) {
      console.log('\nFound roll_no index:', rollNoIndex.name);
      
      // Check if it's sparse
      if (!rollNoIndex.sparse) {
        console.log('⚠ Index is not sparse. Dropping and recreating...');
        
        // Drop the old index
        await usersCollection.dropIndex(rollNoIndex.name);
        console.log('✓ Dropped old index');
        
        // Create new sparse unique index
        await usersCollection.createIndex(
          { roll_no: 1 }, 
          { unique: true, sparse: true, name: 'roll_no_1' }
        );
        console.log('✓ Created new sparse unique index');
      } else {
        console.log('✓ Index is already sparse, no action needed');
      }
    } else {
      console.log('\n⚠ No roll_no index found. Creating sparse unique index...');
      await usersCollection.createIndex(
        { roll_no: 1 }, 
        { unique: true, sparse: true, name: 'roll_no_1' }
      );
      console.log('✓ Created new sparse unique index');
    }

    // Verify the fix
    console.log('\nVerifying indexes...');
    const newIndexes = await usersCollection.indexes();
    const newRollNoIndex = newIndexes.find(idx => idx.key && idx.key.roll_no);
    
    if (newRollNoIndex && newRollNoIndex.sparse) {
      console.log('✅ Success! roll_no index is now sparse');
      console.log('   Multiple users can now register without roll_no');
    } else {
      console.log('❌ Something went wrong. Please check the indexes manually.');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixRollNoIndex();
