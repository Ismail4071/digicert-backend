const express       = require("express");
const router        = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { register, login, resetPassword, getProfile, updateProfile, changePassword } = require("../controllers/authController");

router.post("/register",       register);
router.post("/login",          login);
router.post("/reset-password", resetPassword);
router.get("/profile",         authMiddleware, getProfile);
router.put("/profile",         authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);

module.exports = router;