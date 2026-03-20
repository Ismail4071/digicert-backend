const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");
require("dotenv").config();

const app = express();

// DB connect
connectDB();

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

// 🔥 Serve QR Codes Folder
app.use("/qrcodes", express.static(path.join(__dirname, "qrcodes")));

// Base route
app.get("/", (req, res) => {
  res.send("DigiCert Backend Running");
});

// Routes
const authRoutes        = require("./routes/authRoutes");
const testRoutes        = require("./routes/testRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const adminRoutes       = require("./routes/adminRoutes");
const verifyRoutes      = require("./routes/verifyRoutes");

app.use("/api/auth",         authRoutes);
app.use("/api",              testRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/admin",        adminRoutes);
app.use("/api/verify",       verifyRoutes);

module.exports = app;