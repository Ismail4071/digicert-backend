const express        = require("express");
const router         = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getAllRequests,
  getStats,
  approveCertificate,
  rejectCertificate,
  issueCertificate,
  revokeCertificate,
  getAuditLogs,
  deleteCertificate,
} = require("../controllers/adminController");

// All admin routes require auth
router.use(authMiddleware);

router.get("/certificates",             getAllRequests);
router.get("/stats",                    getStats);
router.put("/certificates/:id/approve", approveCertificate);
router.put("/certificates/:id/reject",  rejectCertificate);
router.put("/certificates/:id/issue",   issueCertificate);
router.put("/certificates/:id/revoke",  revokeCertificate);
router.get("/audit-logs",               getAuditLogs);
router.delete("/certificates/:id",      deleteCertificate);

module.exports = router;