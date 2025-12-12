// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());

// --- เพิ่ม body parsers (เพื่อให้รับ JSON/URL-encoded ถ้า route ใช้ POST) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== DEFAULT deviceSn (ถ้าไม่ได้ส่งจาก client จะใช้ค่านี้) ======
// คุณสามารถเปลี่ยนค่า default ได้ที่ process.env.DEFAULT_DEVICE_SN
// หรือแก้ค่าในตัวแปรด้านล่างเป็น deviceSn ที่ต้องการ
const DEFAULT_DEVICE_SN = process.env.DEFAULT_DEVICE_SN || "YKD0F1022A";

// Middleware: ถ้าเรียก /api/hps แต่ไม่มี query.deviceSn ให้เติมค่า default ให้
app.use((req, res, next) => {
  try {
    // ตรวจ originalUrl เพื่อให้ทำงานก่อน mount /api routes
    if (
      req.originalUrl &&
      req.originalUrl.startsWith("/api/hps") && // /api/hps หรือ /api/hps/...
      (!req.query || !req.query.deviceSn)
    ) {
      // เติม query param deviceSn ให้ (จะถูกอ่านได้ทั้งใน req.query และใน route ที่เรียกต่อ)
      req.query = req.query || {};
      req.query.deviceSn = DEFAULT_DEVICE_SN;
    }
  } catch (err) {
    // ไม่ให้ middleware ล้มทั้งหมดถ้ามี error เล็กน้อย
    console.warn("middleware default deviceSn warn:", err && err.message);
  }
  next();
});

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
