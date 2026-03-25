import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const activateParent = async (email) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const parent = await User.findOne({ email: email.toLowerCase() });
    
    if (!parent) {
      console.log(`❌ No parent found with email: ${email}`);
      process.exit(1);
    }

    console.log(`\n📧 Parent: ${parent.email}`);
    console.log(`👤 Name: ${parent.firstName} ${parent.lastName}`);
    console.log(`🔒 Current Status: ${parent.isActive ? 'Active' : 'Inactive'}`);

    if (!parent.isActive) {
      parent.isActive = true;
      await parent.save();
      console.log(`✅ Parent account activated!`);
    } else {
      console.log(`ℹ️ Parent account is already active`);
    }

    console.log(`\n🔑 Login Credentials:`);
    console.log(`Email: ${parent.email}`);
    console.log(`Password: Check the student's first name + 2025 (e.g., Kiara2025)`);
    console.log(`\nNote: The password is based on the first child's first name + 2025`);

    await mongoose.connection.close();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

const email = process.argv[2];
if (!email) {
  console.log('Usage: node activateParent.js parent@email.com');
  process.exit(1);
}

activateParent(email);
