const Certificate = require("../models/Certificate");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Proof = require("../models/Proof");
const { decryptData } = require("../utils/encrypt");
const createAuditLog = require("../utils/auditLogger");
const generatePDF = require("../utils/generateCertificatePDF");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.CLIENT_URL || "http://localhost:5173";

const log = async (action, userId, userName, details, ip) => {
  try {
    await AuditLog.create({ action, user: userId, userName, details, ip });
  } catch (_) {}
};

// ── GET ALL REQUESTS ──
exports.getAllRequests = async (req, res) => {
  try {
    const certs = await Certificate.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const result = certs.map((c) => {
      const obj = c.toObject();
      return {
        ...obj,
        studentName: obj.studentName || obj.userId?.name || "Unknown",
        userEmail: obj.userId?.email || "",
        status: (obj.status || "pending").toLowerCase(),
        _id: obj._id,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("getAllRequests error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── GET STATS ──
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, certs] = await Promise.all([
      User.countDocuments(),
      Certificate.find(),
    ]);
    res.json({
      totalUsers,
      totalCerts: certs.length,
      pending:    certs.filter((c) => c.status?.toLowerCase() === "pending").length,
      approved:   certs.filter((c) => c.status?.toLowerCase() === "approved").length,
      issued:     certs.filter((c) => c.status?.toLowerCase() === "issued").length,
      rejected:   certs.filter((c) => c.status?.toLowerCase() === "rejected").length,
      correction: certs.filter((c) => c.status?.toLowerCase() === "correction").length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── APPROVE ──
exports.approveCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);

    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    if ((cert.status || "").toLowerCase() === "approved")
      return res.status(400).json({ message: "Certificate already approved" });
    if ((cert.status || "").toLowerCase() === "revoked")
      return res.status(400).json({ message: "Revoked certificate cannot approve" });

    // ===== APPLY CORRECTION =====
    if (cert.correctionType && cert.correctValue) {
      const type = (cert.correctionType || "").toLowerCase();
      if      (type.includes("institution"))                        cert.institution    = cert.correctValue;
      else if (type.includes("course"))                             cert.courseName     = cert.correctValue;
      else if (type.includes("spelling") || type.includes("name"))  cert.studentName    = cert.correctValue;
      else if (type.includes("date"))                               cert.completionDate = cert.correctValue;
      else if (type.includes("grade"))                              cert.grade          = cert.correctValue;
      else if (type.includes("mismatch") || type.includes("id"))    cert.certificateId  = cert.correctValue;
      console.log(`Correction applied [${cert.correctionType}]: "${cert.currentValue}" → "${cert.correctValue}"`);
    }

    // ===== UPDATE STATUS =====
    cert.status = "APPROVED";
    if (!cert.issueDate) cert.issueDate = cert.completionDate || new Date();

    // ===== UPDATE PROOF STATUS =====
    await Proof.findOneAndUpdate(
      { userId: cert.userId, status: "PENDING" },
      { status: "VERIFIED" }
    );

    // ===== DECRYPT DATA =====
    let decrypted = {};
    try {
      const raw = decryptData(cert.encryptedData);
      decrypted = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (err) {
      console.warn("Decrypt fallback:", err.message);
    }

    const studentName = cert.studentName || decrypted.name   || "Student";
    const courseName  = cert.courseName  || decrypted.course || "Course";
    const certNumber  = cert.certNumber  || cert.certificateId;

    const issueDateStr = new Date(cert.issueDate).toDateString();

    // ===== QR GENERATION =====
    const verifyUrl = `${BASE_URL}/verify?cert=${certNumber}`;
    const qrDir     = path.join(__dirname, "../qrcodes");
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
    const qrPath = path.join(qrDir, `${cert.certificateId}.png`);
    await QRCode.toFile(qrPath, verifyUrl);
    cert.qrCode = qrPath;
    cert.qrPath = qrPath;

    // ===== PDF GENERATION =====
    const result = await generatePDF({
      studentName,
      courseName,
      certNumber,
      certificateId: cert.certificateId,
      issueDate:     issueDateStr,
      qrPath,
    });
    cert.pdfPath = typeof result === "string" ? result : result.pdfPath;

    // ===== SAVE =====
    await cert.save();

    // ===== AUDIT =====
    await createAuditLog({
      action:        "CERTIFICATE_APPROVED",
      performedBy:   req.user.id,
      certificateId: cert.certificateId,
      details:       `Approved certificate for ${studentName}`,
    });

    res.json({
      message:    "Certificate approved + QR + PDF generated",
      verifyUrl,
      qrCodePath: qrPath,
      pdfPath:    cert.pdfPath,
    });
  } catch (err) {
    console.error("Approve Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── REJECT ──
exports.rejectCertificate = async (req, res) => {
  try {
    const { reason } = req.body;
    const cert = await Certificate.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejectionReason: reason || "" },
      { new: true }
    );
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    await log("rejected", req.user.id, "Admin",
      `Rejected: ${cert.courseName} — ${reason}`, req.ip);
    res.json({ message: "Certificate rejected", certificate: cert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── ISSUE ──
exports.issueCertificate = async (req, res) => {
  try {
    const { certificateNumber, issueDate, grade, duration, instructorName, remarks } = req.body;

    const certNumber =
      certificateNumber ||
      `DC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const cert = await Certificate.findByIdAndUpdate(
      req.params.id,
      {
        status:         "issued",
        certNumber,
        issueDate:      issueDate      || new Date(),
        grade:          grade          || "",
        duration:       duration       || "",
        instructorName: instructorName || "",
        remarks:        remarks        || "",
        issuedBy:       "DigiCert",
      },
      { new: true }
    );
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    await log("issued", req.user.id, "Admin",
      `Issued: ${certNumber} for ${cert.studentName}`, req.ip);
    res.json({ message: "Certificate issued!", certificate: cert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── REVOKE ──
exports.revokeCertificate = async (req, res) => {
  try {
    const { reason } = req.body;
    console.log("REVOKE called:", req.params.id, "reason:", reason, "user:", req.user?.id);
    const cert = await Certificate.findById(req.params.id);
    console.log("REVOKE cert found:", cert?._id, "status:", cert?.status);
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    if ((cert.status || "").toLowerCase() === "revoked")
      return res.status(400).json({ message: "Certificate already revoked" });
    if (!["issued", "approved", "correction"].includes((cert.status || "").toLowerCase()))
      return res.status(400).json({ message: `Cannot revoke certificate with status: ${cert.status}` });

    cert.status = "revoked";
    cert.rejectionReason = reason || "Revoked by admin";
    await cert.save();

    await log("revoked", req.user.id, "Admin",
      `Revoked: ${cert.certNumber || cert.certificateId} — ${reason || "No reason given"}`, req.ip);

    res.json({ message: "Certificate revoked successfully", certificate: cert });
  } catch (err) {
    console.error("REVOKE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── AUDIT LOGS ──
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE CERTIFICATE ──
exports.deleteCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    await Certificate.findByIdAndDelete(req.params.id);
    await createAuditLog(req.user?.name || "Admin", "DELETE_CERTIFICATE", `Deleted cert: ${cert.certNumber || cert.certificateId}`);
    res.json({ message: "Certificate deleted successfully" });
  } catch (err) {
    console.error("Admin delete error:", err);
    res.status(500).json({ message: err.message });
  }
};