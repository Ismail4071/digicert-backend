const express = require("express");
const { verifyCertificate } = require("../controllers/verifyController");

const router = express.Router();

router.get("/:certificateId", verifyCertificate);

module.exports = router;
