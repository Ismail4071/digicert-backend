require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.findOne({ role: /admin/i }).lean();
    console.log('Admin user:', admin ? { id: admin._id, email: admin.email, role: admin.role } : 'none');
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
