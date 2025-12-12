// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== DEFAULT deviceSn =====
const DEFAULT_DEVICE_SN = process.env.DEFAULT_DEVICE_SN || "YKD0F1022A";

// ===== Middleware: auto inject deviceSn (เฉพาะ /api/hps*) =====
app.use((req, res, next) => {
  try {
    const url = req.originalUrl || "";

    if (url.startsWith("/api/hps")) {
      if (!req.query.deviceSn) {
        req.query.deviceSn = DEFAULT_DEVICE_SN;
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[${new Date().toISOString()}] inject deviceSn(query):`,
            DEFAULT_DEVICE_SN
          );
        }
      }

      if (!req.body.deviceSn) {
        req.body.deviceSn = DEFAULT_DEVICE_SN;
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[${new Date().toISOString()}] inject deviceSn(body):`,
            DEFAULT_DEVICE_SN
          );
        }
      }
    }
  } catch (err) {
    console.warn("deviceSn middleware error:", err?.message);
  }
  next();
});

// ===== ROUTES =====
const hpsRoutes = require("./routes/index");
const { fetchRealtimeData } = require("./routes/excelUtil");

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
    }
  } catch (err) {
    log("❌ fetchAndCacheSummary error:", err?.message);
  }
};

app.get("/api/summary", (req, res) => {
  if (!cachedSummary) {
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
  res.json(cachedSummary);
});

// ===== API ROUTES =====
app.use("/api", hpsRoutes);

// ===== AUTO REFRESH =====
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 6 * 60 * 1000);

// ===== START SERVER =====
app.listen(PORT, () => {
  log(`🚀 Server running at http://localhost:${PORT}`);
});
