// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== DEFAULT deviceSn =====
// เปลี่ยนค่านี้หรือเซ็ต env DEFAULT_DEVICE_SN ก่อนรันถ้าต้องการค่าอื่น
const DEFAULT_DEVICE_SN = process.env.DEFAULT_DEVICE_SN || "YKD0F1022A";

// ===== Middleware: auto inject deviceSn =====
// เติม deviceSn ให้ทั้ง req.query (GET) และ req.body (POST) เมื่อ path มี '/api/hps'
app.use((req, res, next) => {
  try {
    const url = req.originalUrl || "";
    if (url.includes("/api/hps")) {
      // เติมใน query (สำหรับ GET)
      req.query = req.query || {};
      if (!req.query.deviceSn) {
        req.query.deviceSn = DEFAULT_DEVICE_SN;
        // เบาๆ log เพื่อ debug เฉพาะใน dev
        console.log(`[${new Date().toISOString()}] middleware: injected deviceSn into req.query -> ${req.query.deviceSn}`);
      }

      // เติมใน body (สำหรับ POST)
      req.body = req.body || {};
      if (!req.body.deviceSn) {
        req.body.deviceSn = DEFAULT_DEVICE_SN;
        console.log(`[${new Date().toISOString()}] middleware: injected deviceSn into req.body -> ${req.body.deviceSn}`);
      }
    }
  } catch (err) {
    console.warn("Default deviceSn middleware error:", err && err.message);
  }
  next();
});

// ===== ROUTES / UTIL =====
const hpsRoutes = require("./routes/index");
const { fetchRealtimeData } = require("./routes/excelUtil");

// LOG helper
const log = (...args) => {
  console.log(`[${new Date().toISOString()}]`, ...args);
};

// ===== SUMMARY CACHE =====
let cachedSummary = null;

const fetchAndCacheSummary = async () => {
  try {
    const realtime = await fetchRealtimeData();
    if (realtime) {
      cachedSummary = { ...realtime, source: "live" };
    } else {
      log("⚠️ No realtime data fetched");
    }
  } catch (err) {
    log("❌ fetchAndCacheSummary error:", err && err.message);
  }
};

const getCachedSummary = () => cachedSummary;

// ===== SUMMARY ENDPOINT =====
app.get("/api/summary", (req, res) => {
  const summary = getCachedSummary();

  if (!summary) {
    return res.json({
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

  res.json(summary);
});

// ===== MOUNT API ROUTES =====
app.use("/api", hpsRoutes);

// ===== AUTO REFRESH SUMMARY =====
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 6 * 60 * 1000);

// ===== START SERVER =====
app.listen(PORT, () => {
  log(`🚀 Server running at http://localhost:${PORT}`);
});
