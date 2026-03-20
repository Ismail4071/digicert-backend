const Proof       = require("../models/Proof");
const Certificate = require("../models/Certificate");
const generateHash   = require("../utils/hashGenerator");
const { encryptData, decryptData } = require("../utils/encrypt");
const createAuditLog  = require("../utils/auditLogger");
const generatePDF     = require("../utils/generateCertificatePDF");
const QRCode          = require("qrcode");
const fs     = require("fs");
const crypto = require("crypto");
const path   = require("path");

// ══════════════════════════════════════
// REQUEST CERTIFICATE
// ══════════════════════════════════════
exports.requestCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const file   = req.file;
    const { name, course, studentName, courseName, completionDate, grade, phone, institution, notes, description, email } = req.body;

    const finalName   = name   || studentName;
    const finalCourse = course || courseName;

    if (!finalName || !finalCourse) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ message: "Name and Course required" });
    }

    // Proof file — optional
    let proof = null;
    if (file) {
      const fileBuffer = fs.readFileSync(file.path);
      const fileHash   = generateHash(fileBuffer);
      proof = await Proof.create({
        userId, filePath: file.path, fileHash, status: "PENDING",
      });
    }

    const certificatePayload = {
      userId, name: finalName, course: finalCourse,
      proofId: proof?._id, requestedAt: new Date(),
      completionDate, grade, phone, institution,
      notes: notes || description,
    };
    const encryptedData = encryptData(certificatePayload);

    const certificate = await Certificate.create({
      userId,
      certificateId:  crypto.randomUUID(),
      studentName:    finalName,
      courseName:     finalCourse,
      completionDate: completionDate || null,
      grade:          grade       || "",
      phone:          phone       || "",
      institution:    institution || "",
      notes:          notes || description || "",
      proofId:        proof?._id || null,
      encryptedData,
      status: "PENDING",
    });

    await createAuditLog({
      action:        "CERTIFICATE_REQUESTED",
      performedBy:   userId,
      certificateId: certificate.certificateId,
      details:       `Certificate requested by ${finalName} for ${finalCourse}`,
    });

    return res.status(201).json({
      message:       "Certificate request submitted",
      certificateId: certificate.certificateId,
      proofId:       proof?._id || null,
    });
  } catch (error) {
    console.error("Certificate Request Error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ══════════════════════════════════════
// GET MY CERTIFICATES
// ══════════════════════════════════════
exports.getMyCertificates = async (req, res) => {
  try {
    const certs = await Certificate.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const result = certs.map(c => ({
      ...c.toObject(),
      status: (c.status || "PENDING").toLowerCase(),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════
// GET MY STATS
// ══════════════════════════════════════
exports.getMyStats = async (req, res) => {
  try {
    const certs = await Certificate.find({ userId: req.user.id });
    res.json({
      total:      certs.length,
      pending:    certs.filter(c => c.status?.toLowerCase() === "pending").length,
      approved:   certs.filter(c => c.status?.toLowerCase() === "approved").length,
      issued:     certs.filter(c => c.status?.toLowerCase() === "issued").length,
      correction: certs.filter(c => c.status?.toLowerCase() === "correction").length,
      rejected:   certs.filter(c => c.status?.toLowerCase() === "rejected").length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════
// DOWNLOAD CERTIFICATE
// ══════════════════════════════════════
const generateCertificateAssets = async (cert) => {
  const certDir = path.join(__dirname, "../certificates");
  const qrDir   = path.join(__dirname, "../qrcodes");

  if (!fs.existsSync(qrDir))  fs.mkdirSync(qrDir,  { recursive: true });
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  let decrypted = {};
  try {
    const raw = decryptData(cert.encryptedData);
    decrypted = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {}

  const name   = cert.studentName || decrypted.name   || "Student";
  const course = cert.courseName  || decrypted.course || "Course";

  const issueDate    = cert.issueDate ? new Date(cert.issueDate) : new Date();
  const issueDateStr = issueDate.toDateString();

  const qrPath    = path.join(qrDir, `${cert.certificateId}.png`);
  const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify?cert=${cert.certNumber || cert.certificateId}`;

  await QRCode.toFile(qrPath, verifyUrl);

  const result  = await generatePDF({
    studentName: name,
    courseName:  course,
    certNumber:  cert.certNumber || cert.certificateId,
    certificateId: cert.certificateId,
    issueDate:   issueDateStr,
    qrPath,
  });

  const pdfPath = typeof result === "string" ? result : result.pdfPath;

  const updatedFields = {};
  if (cert.qrCode  !== qrPath)  updatedFields.qrCode  = qrPath;
  if (cert.pdfPath !== pdfPath) updatedFields.pdfPath = pdfPath;
  if (Object.keys(updatedFields).length > 0)
    await Certificate.findByIdAndUpdate(cert._id, updatedFields);

  return { qrPath, pdfPath };
};

exports.downloadCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findOne({ _id: req.params.id, userId: req.user.id });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });

    const status = (cert.status || "").toLowerCase();
    if (status !== "issued" && status !== "approved")
      return res.status(400).json({ message: "Certificate not approved yet" });

    let filePath = cert.pdfPath;
    if (!filePath || !fs.existsSync(filePath)) {
      const results = await generateCertificateAssets(cert);
      filePath = results.pdfPath;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Certificate file not generated yet. Please contact admin." });
    }

    return res.download(filePath, `DigiCert_${cert.certNumber || cert.certificateId}.pdf`);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════
// CORRECTION REQUEST — FIXED
// ══════════════════════════════════════
exports.submitCorrectionRequest = async (req, res) => {
  try {
    const cert = await Certificate.findOne({ _id: req.params.id, userId: req.user.id });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });

    const { correctionType, currentValue, correctValue, reason } = req.body;

    // Frontend sends fullReason: "[Type] Current: "x" → Correct: "y". explanation"
    let finalType    = correctionType || "";
    let finalCurrent = currentValue   || "";
    let finalCorrect = correctValue   || "";
    let finalNote    = reason         || "";

    if (reason && reason.includes("Correct:")) {
      const tm = reason.match(/^\[(.+?)\]/);
      const cm = reason.match(/Current: "(.+?)"/);
      const rm = reason.match(/Correct: "(.+?)"/);
      const nm = reason.match(/\.\s(.+)$/s);
      if (tm) finalType    = tm[1];
      if (cm) finalCurrent = cm[1];
      if (rm) finalCorrect = rm[1];
      if (nm) finalNote    = nm[1];
    }

    // Save proof file if attached
    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileHash   = generateHash(fileBuffer);
        const proof = await Proof.create({
          userId: req.user.id, filePath: req.file.path, fileHash, status: "PENDING",
        });
        cert.proofId   = proof._id;
        cert.proofFile = req.file.path;
      } catch (fileErr) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error("Proof file save error:", fileErr);
      }
    }

    cert.status         = "correction";
    cert.correctionNote = finalNote || `${finalType}: "${finalCurrent}" → "${finalCorrect}"`;
    cert.correctionType = finalType;
    cert.currentValue   = finalCurrent;
    cert.correctValue   = finalCorrect;
    await cert.save();

    res.json({ message: "Correction request submitted!", certificate: cert });
  } catch (err) {
    console.error("Correction request error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════
// VERIFY CERTIFICATE (Public)
// ══════════════════════════════════════
exports.downloadPublicCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findOne({
      $or: [
        { certNumber:    req.params.certNumber },
        { certificateId: req.params.certNumber },
      ]
    });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });

    const status = (cert.status || "").toLowerCase();
    if (status !== "issued" && status !== "approved")
      return res.status(400).json({ message: "Certificate not approved yet" });

    let filePath = cert.pdfPath;
    if (!filePath || !fs.existsSync(filePath)) {
      const results = await generateCertificateAssets(cert);
      filePath = results.pdfPath;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Certificate file not generated yet. Please contact admin." });
    }

    return res.download(filePath, `DigiCert_${cert.certNumber || cert.certificateId}.pdf`);
  } catch (err) {
    console.error("Public download error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.verifyCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findOne({
      $or: [
        { certNumber:    req.params.certNumber },
        { certificateId: req.params.certNumber },
      ]
    }).select('-_id -__v -encryptedData -proofId -proofFile -qrCode -pdfPath -qrPath -correctionType -currentValue -correctValue -correctionNote -rejectionReason -notes -remarks -duration -grade');
    
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    res.json({
      ...cert.toObject(),
      status: (cert.status || "pending").toLowerCase(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};