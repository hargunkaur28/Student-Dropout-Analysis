import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const testLogin = async (email, password) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log(`🔐 Testing login for: ${email}`);
    console.log(`🔑 Password: ${password}\n`);

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      console.log('❌ User not found!');
      process.exit(1);
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`👤 Role: ${user.role}`);
    console.log(`🔒 Active: ${user.isActive}`);
    console.log(`👶 Children: ${user.children?.length || 0}\n`);

    if (!user.isActive) {
      console.log('❌ Account is inactive!');
      console.log('💡 Run: node activateParent.js ' + email);
      process.exit(1);
    }

    // Test password
    const isMatch = await user.comparePassword(password);
    
    if (isMatch) {
      console.log('✅ Password is CORRECT!');
      console.log('✅ Login should work!\n');
      console.log('🌐 Try logging in at: http://localhost:5174/login');
    } else {
      console.log('❌ Password is INCORRECT!');
      console.log('💡 Expected password format: {FirstChildName}2025');
      console.log('💡 Example: If first child is "Rahul", password is "Rahul2025"');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node testParentLogin.js email password');
  console.log('Example: node testParentLogin.js someone@gmail.com Tanvi2025');
  process.exit(1);
}

testLogin(email, password);
