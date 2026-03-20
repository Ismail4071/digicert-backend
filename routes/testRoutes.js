const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

// Protected test route
router.get("/test", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "JWT working",
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

module.exports = router;
