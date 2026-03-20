const mongoose = require("mongoose");

const proofSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  filePath: {
    type: String,
    required: true,
    trim: true
  },

  fileHash: {
    type: String,
    required: true,
    trim: true
  },

  status: {
    type: String,
    enum: ["PENDING", "VERIFIED", "REJECTED"],
    default: "PENDING"
  },

  uploadedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true   // 🔥 adds createdAt & updatedAt automatically
});

module.exports = mongoose.model("Proof", proofSchema);