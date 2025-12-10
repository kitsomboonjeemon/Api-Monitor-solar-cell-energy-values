// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());

// 🔗 นำเข้า router และ util
const hpsRoutes = require("./routes/index");
const { fetchRealtimeData } = require("./routes/excelUtil");

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
  } else {
    log("⚠️ No realtime data fetched");
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

// 🔗 route อื่น ๆ เช่น /api/hps/history หรือ /api/hps
app.use("/api", hpsRoutes);

// 🔁 เรียก fetch summary ทุก 6 นาที
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 6 * 60 * 1000);

// ✅ เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  const time = new Date().toISOString();
  console.log(`[${time}] 🚀 Server running at http://localhost:${PORT}`);
});
