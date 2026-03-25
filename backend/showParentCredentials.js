import mongoose from 'mongoose';
import User from './src/models/User.js';
import Student from './src/models/Student.js';
import dotenv from 'dotenv';

dotenv.config();

const showParentCredentials = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all parent accounts
    const parents = await User.find({ role: 'parent' })
      .populate('children', 'firstName lastName rollNumber section')
      .lean();

    console.log(`📊 Found ${parents.length} parent accounts\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const parent of parents) {
      // Activate if inactive
      if (!parent.isActive) {
        await User.findByIdAndUpdate(parent._id, { isActive: true });
        console.log(`✅ Activated: ${parent.email}`);
      }

      const firstChild = parent.children && parent.children.length > 0 ? parent.children[0] : null;
      const password = firstChild ? `${firstChild.firstName}2025` : 'Unknown';

      console.log(`👤 Parent: ${parent.firstName} ${parent.lastName}`);
      console.log(`📧 Email: ${parent.email}`);
      console.log(`🔑 Password: ${password}`);
      console.log(`👶 Children: ${parent.children?.length || 0}`);
      
      if (parent.children && parent.children.length > 0) {
        parent.children.forEach((child, index) => {
          console.log(`   ${index + 1}. ${child.firstName} ${child.lastName} (${child.rollNumber}) - ${child.section}`);
        });
      }
      
      console.log(`🔗 Login URL: http://localhost:5174/login`);
      console.log(`🔒 Status: ${parent.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    console.log(`\n📝 Summary:`);
    console.log(`Total Parent Accounts: ${parents.length}`);
    console.log(`Active Accounts: ${parents.filter(p => p.isActive).length}`);
    console.log(`\n💡 To login as a parent:`);
    console.log(`1. Go to http://localhost:5174/login`);
    console.log(`2. Use the email and password shown above`);
    console.log(`3. Password format: {FirstChildName}2025 (e.g., Kiara2025)`);

    await mongoose.connection.close();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

showParentCredentials();
