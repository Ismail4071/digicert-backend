const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  // ── Owner ──
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
    required: true,
  },

  // ── Identity ──
  certificateId: { type: String, unique: true },
  certNumber:    { type: String, default: "" },   // DC-2026-XXXXX (after issue)

  // ── Request Details (plain — for admin display) ──
  studentName:    { type: String, default: "" },
  courseName:     { type: String, default: "" },
  completionDate: { type: Date },
  grade:          { type: String, default: "" },
  phone:          { type: String, default: "" },
  institution:    { type: String, default: "" },
  notes:          { type: String, default: "" },

  // ── Encrypted payload ──
  encryptedData: { type: String, default: "" },

  // ── Proof ──
  proofId:   { type: mongoose.Schema.Types.ObjectId, ref: "Proof" },
  proofFile: { type: String, default: null },

  // ── Status ──
  status: {
    type:    String,
    enum:    ["PENDING", "APPROVED", "ISSUED", "REJECTED", "CORRECTION", "REVOKED",
              "pending", "approved", "issued", "rejected", "correction", "revoked"],
    default: "PENDING",
  },

  // ── Admin Actions ──
  rejectionReason: { type: String, default: "" },
  correctionNote:    { type: String, default: "" },
  correctionType:   { type: String, default: "" },
  currentValue:     { type: String, default: "" },
  correctValue:     { type: String, default: "" },

  // ── Issue Details ──
  issueDate:      { type: Date },
  instructorName: { type: String, default: "" },
  duration:       { type: String, default: "" },
  remarks:        { type: String, default: "" },
  issuedBy:       { type: String, default: "DigiCert" },

  // ── Generated Files ──
  pdfPath: { type: String, default: null },
  qrPath:  { type: String, default: null },

}, { timestamps: true });

module.exports = mongoose.model("Certificate", certificateSchema);