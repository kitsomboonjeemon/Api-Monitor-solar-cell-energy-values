// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3001;

app.use(cors());

// 🔗 นำเข้า router และ util
const hpsRoutes = require("./routes/index");
const { saveToExcel, fetchRealtimeData } = require("./routes/excelUtil");

// ====== LOG Helper ======
const log = (...args) => {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
};

// ====== Summary Cache (ใช้จาก fetchRealtimeData) ======
let cachedSummary = null;

const fetchAndCacheSummary = async () => {
  const realtime = await fetchRealtimeData();
  if (realtime) {
    cachedSummary = {
      ...realtime,
      source: "live",
    };
  }
};

const getCachedSummary = () => cachedSummary;

// 🔁 Summary endpoint
app.get("/api/summary", (req, res) => {
  const summary = getCachedSummary();
  if (summary) {
    res.json(summary);
  } else {
    res.json({
      pvEnergy: 0,
      pvTotal: 0,
      loadEnergy: 0,
      loadTotal: 0,
      batCharge: 0,
      batDischarge: 0,
      gridImport: 0,
      gridExport: 0,
      outputFreq: 0,
      time: "N/A",
      source: "empty",
    });
  }
});

// ✅ Endpoint สำหรับดาวน์โหลด Excel ล่าสุด
// app.get("/api/download-latest", (req, res) => {
//   const OUTPUT_DIR = "D:/BNsolarpower/download";
//   const files = fs
//     .readdirSync(OUTPUT_DIR)
//     .filter((file) => file.endsWith(".xlsx"))
//     .sort((a, b) => {
//       const aTime = fs.statSync(path.join(OUTPUT_DIR, a)).mtime.getTime();
//       const bTime = fs.statSync(path.join(OUTPUT_DIR, b)).mtime.getTime();
//       return bTime - aTime;
//     });

//   if (files.length === 0) {
//     return res.status(404).send("No Excel files available.");
//   }

//   const latestFile = path.join(OUTPUT_DIR, files[0]);
//   res.download(latestFile, files[0], (err) => {
//     if (err) {
//       console.error("❌ Download error:", err.message);
//       res.status(500).send("Failed to download file.");
//     }
//   });
// });

// 🔗 route อื่น ๆ เช่น /api/hps/history หรือ /api/hps
app.use("/api", hpsRoutes);

// 🔁 เรียก fetch summary ทุก 6 นาที
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 6 * 60 * 1000);

// 🔁 Export Excel อัตโนมัติทุก 6 นาที เริ่มหลัง 3 นาที
let isExporting = false;

setTimeout(() => {
  setInterval(async () => {
    if (isExporting) return;
    isExporting = true;

    try {
      const summary = getCachedSummary();
      if (!summary) {
        log("⚠️ No cached summary available");
        return;
      }
      await saveToExcel(summary);
      log("✅ Auto-export to Excel");
    } catch (err) {
      log("❌ Auto-export error:", err.message);
    } finally {
      isExporting = false;
    }
  }, 6 * 60 * 1000);
}, 3 * 60 * 1000);

// ✅ เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  const time = new Date().toISOString();
  console.log(`[${time}] 🚀 Server running at http://localhost:${PORT}`);
});
