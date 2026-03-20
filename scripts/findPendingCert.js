require('dotenv').config();
const mongoose = require('mongoose');
const Certificate = require('../models/Certificate');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const cert = await Certificate.findOne({ status: /pending/i }).lean();
    console.log('Sample pending cert:', cert ? { id: cert._id, certificateId: cert.certificateId, status: cert.status, studentName: cert.studentName } : 'none');
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
