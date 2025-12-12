// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== DEFAULT deviceSn =====
// ใช้ค่านี้เมื่อ frontend ไม่ได้ส่ง deviceSn มา
const DEFAULT_DEVICE_SN = process.env.DEFAULT_DEVICE_SN || "YKD0F1022A";

// ===== Middleware: auto inject deviceSn =====
// เติม deviceSn ให้ทั้ง Query และ Body
app.use((req, res, next) => {
  try {
    if (req.originalUrl.startsWith("/api/hps")) {
      // ensure query
      req.query = req.query || {};
      if (!req.query.deviceSn) {
        req.query.deviceSn = DEFAULT_DEVICE_SN;
      }

      // ensure body
      req.body = req.body || {};
      if (!req.body.deviceSn) {
        req.body.deviceSn = DEFAULT_DEVICE_SN;
      }
    }
  } catch (err) {
    console.warn("Default deviceSn middleware error:", err.message);
  }

  next();
});

// ===== ROUTES =====
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
    log("❌ fetchAndCacheSummary error:", err.message);
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

// ===== MOUNT ROUTES =====
app.use("/api", hpsRoutes);

// ===== AUTO REFRESH SUMMARY =====
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 6 * 60 * 1000);

// ===== START SERVER =====
app.listen(PORT, () => {
  log(`🚀 Server running at http://localhost:${PORT}`);
});
