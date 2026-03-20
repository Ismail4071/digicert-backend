const express        = require("express");
const router         = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const upload         = require("../middleware/uploadMiddleware");
const {
  requestCertificate,
  getMyCertificates,
  getMyStats,
  downloadCertificate,
  submitCorrectionRequest,
  verifyCertificate,
  downloadPublicCertificate,
} = require("../controllers/certificateController");

// ── Public ──
router.get("/verify/:certNumber", verifyCertificate);
router.get("/verify/:certNumber/download", downloadPublicCertificate);

// ── User (auth required) ──
router.get("/my",              authMiddleware, getMyCertificates);
router.get("/my/stats",        authMiddleware, getMyStats);
router.get("/:id/debug",       authMiddleware, async (req, res) => {
  try {
    const Certificate = require("../models/Certificate");
    const cert = await Certificate.findOne({ _id: req.params.id, userId: req.user.id });
    if (!cert) return res.status(404).json({ message: "Not found" });
    res.json({
      _id: cert._id,
      certificateId: cert.certificateId,
      pdfPath: cert.pdfPath,
      status: cert.status,
      exists: require("fs").existsSync(cert.pdfPath || "")
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:id/download",    authMiddleware, downloadCertificate);
router.post("/request",        authMiddleware, upload.single("proof"), requestCertificate); // create and verify send route

router.post("/:id/correction", authMiddleware, upload.single("proof"), submitCorrectionRequest);

module.exports = router;