const Certificate = require("../models/Certificate");

exports.verifyCertificate = async (req, res) => {
  try {
    const certificateId = (req.params.certificateId || "").trim();
    const certNumber = (req.params.certNumber || "").trim();
    const query = (certificateId || certNumber).trim();

    // Escape regex meta-characters for safe searching
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const safeQuery = escapeRegex(query);

    // Search by BOTH certificateId (UUID) OR certNumber (DC-2026-XXXXX) — case-insensitive
    const cert = await Certificate.findOne({
      $or: [
        { certificateId: { $regex: `^${safeQuery}$`, $options: "i" } },
        { certNumber:    { $regex: `^${safeQuery}$`, $options: "i" } }
      ]
    });

    if (!cert) {
      return res.status(404).json({
        status: "not_found",
        message: "Certificate does not exist"
      });
    }

    const status = (cert.status || "").toLowerCase();

    if (status === "revoked") {
      return res.json({
        ...cert.toObject(),
        status: "revoked",
        message: "Certificate has been revoked"
      });
    }

    if (status === "pending") {
      return res.json({
        ...cert.toObject(),
        status: "pending",
        message: "Certificate not yet approved"
      });
    }

    if (status === "approved") {
      return res.json({
        ...cert.toObject(),
        status: "approved",
        message: "Certificate approved — waiting to be issued"
      });
    }

    if (status === "issued") {
      return res.json({
        ...cert.toObject(),
        status: "issued",
        message: "Certificate is valid and issued"
      });
    }

    if (status === "rejected") {
      return res.json({
        ...cert.toObject(),
        status: "rejected",
        message: "Certificate has been rejected"
      });
    }

    if (status === "correction") {
      return res.json({
        ...cert.toObject(),
        status: "correction",
        message: "Certificate marked for correction"
      });
    }

    // Fallback for any other status
    return res.json({
      ...cert.toObject(),
      status: status,
      message: "Certificate status: " + status
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
