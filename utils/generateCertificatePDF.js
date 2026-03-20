const PDFDocument = require("pdfkit");
const QRCode      = require("qrcode");
const fs          = require("fs");
const path        = require("path");

const generateCertificate = async (data) => {
  return new Promise(async (resolve, reject) => {
    try {

      // ===== VALIDATION =====
      const studentName   = data.studentName || data.name;
      const courseName    = data.courseName  || data.course;
      const certNumber    = data.certNumber  || data.certificateId;
      const certificateId = data.certificateId || data.certNumber;
      if (!studentName || !courseName || !certNumber)
        throw new Error(`Invalid data — name=${studentName}, course=${courseName}, id=${certNumber}`);

      // ===== FOLDERS =====
      const certDir = path.join(__dirname, "../certificates");
      const qrDir   = path.join(__dirname, "../qrcodes");
      if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
      if (!fs.existsSync(qrDir))   fs.mkdirSync(qrDir,   { recursive: true });

      // ===== PATHS =====
      const filePath = path.join(certDir, `${certNumber}.pdf`);
      const qrPath   = data.qrPath || path.join(qrDir, `${certNumber}.png`);

      // ===== QR CODE =====
      const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify?cert=${certNumber}`;
      if (!data.qrPath || !fs.existsSync(qrPath)) {
        await QRCode.toFile(qrPath, verifyUrl, {
          width: 300, margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
      }

      // ===== TEMPLATE =====
      let templatePath = path.join(__dirname, "../assets/certificate-template.jpeg");
      if (!fs.existsSync(templatePath))
        templatePath = path.join(__dirname, "../assets/certificate-template.png");
      if (!fs.existsSync(templatePath))
        throw new Error("certificate-template not found in backend/assets/");

      // ===== HELPERS =====
      const safeText = (v) => String(v || "").replace(/[\n\r]+/g, " ").trim();
      const toTitleCase = (s) => {
        const upper = ["ui","ux","it","ai","ml","sql","html","css","php","aws","api","java","python"];
        return s.replace(/\w\S*/g, w => {
          const low = w.toLowerCase();
          if (upper.includes(low)) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          return w[0].toUpperCase() + w.slice(1).toLowerCase();
        });
      };

      // Date format: "Wed Feb 25, 2026"
      const formattedDate = new Date(data.issueDate || Date.now())
        .toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric", year:"numeric" });



      // ===== COORDINATE SYSTEM =====
      // Reference image: 1536 x 1024 px → PDF A4 landscape: 842 x 595 pt
      const PW = 842, PH = 595, TW = 1536, TH = 1024;
      const scx = (x) => (x / TW) * PW;
      const scy = (y) => (y / TH) * PH;

      // ===== PDF SETUP =====
      const doc    = new PDFDocument({ layout:"landscape", size:"A4", margin:0 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ── BACKGROUND ──
      doc.image(templatePath, 0, 0, { width: PW, height: PH });

      // ── NAME ──
      // Pixel scan: blue row at y≈375, color RGB(31,87,180) → #1B57B4
      doc
        .fillColor("#1a57b4")
        .font("Helvetica-Bold")
        .fontSize(38)
        .text(
          safeText(studentName).toUpperCase(),
          0, scy(355),
          { align:"center", width:PW, lineBreak:false }
        );

      // ── COURSE ──
      // Pixel scan: blue row at y≈527, color RGB(22,89,194) → #1659C2
      doc
        .fillColor("#1659c2")
        .font("Helvetica-Bold")
        .fontSize(26)
        .text(
          toTitleCase(safeText(courseName)),
          scx(300), scy(518),
          { align:"center", width:scx(936), lineBreak:false }
        );

      // ── DATE — "Issued On:" red text ──
      // Pixel scan: red starts at x=510, y=617
      doc
        .fillColor("#c8060e")
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(
          formattedDate,
          scx(510), scy(617),
          { lineBreak:false }
        );



      // ── CERTIFICATE ID ──
      // White box: x=400 to 1199, text center y=738, color #262626
      // UUID is long — use font size 11 to fit
      doc
        .fillColor("#262626")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(
          safeText(certificateId),
          scx(405), scy(730),
          { align:"center", width:scx(790), lineBreak:false }
        );

      // ── QR CODE ──
      // QR right side: center_x=823, top_y=755, width=162px in 1536 ref
      const qrSize = scx(162);
      const qrX    = scx(823) - qrSize / 2;
      const qrY    = scy(755);
      doc.image(qrPath, qrX, qrY, { width: qrSize });

      // ===== END =====
      doc.end();
      stream.on("finish", () => {
        console.log("✅ PDF generated:", filePath);
        resolve({ pdfPath: filePath, qrPath });
      });
      stream.on("error", (err) => { reject(err); });

    } catch (error) {
      console.error("Certificate generation error:", error);
      reject(error);
    }
  });
};

module.exports = generateCertificate;