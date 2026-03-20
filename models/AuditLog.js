const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action:    { type: String, required: true },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userName:  { type: String, default: "" },
  userEmail: { type: String, default: "" },
  role:      { type: String, default: "" },
  details:   { type: String, default: "" },
  ip:        { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("AuditLog", auditLogSchema);