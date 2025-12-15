const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());

// routes อื่น (history / graph)
const hpsRoutes = require("./routes/index");

// ✅ ดึงจาก excelUtil.js
const { fetchRealtimeData } = require("./routes/excelUtil");

// ================= SUMMARY CACHE =================
let cachedSummary = null;
let lastUpdated = null;

const fetchAndCacheSummary = async () => {
  try {
    const data = await fetchRealtimeData();

    if (data) {
      cachedSummary = {
        pvEnergy: data.pvEnergy,
        loadEnergy: data.loadEnergy,
        batCharge: data.batCharge,
        batDischarge: data.batDischarge,
        gridImport: data.gridImport,
        gridExport: data.gridExport,
        outputFreq: data.outputFreq,
        irradiance: data.irradiance,
        backplaneTemp: data.backplaneTemp,
        co2Reduced: data.co2Reduced,
        ktoe: data.ktoe,
        source: "cache",
      };

      lastUpdated = new Date().toISOString();
      console.log("✅ Summary cached @", lastUpdated);
    } else {
      console.log("⚠️ fetchRealtimeData returned null");
    }
  } catch (err) {
    console.error("❌ fetchAndCacheSummary error:", err.message);
  }
};

// 🔁 ดึงครั้งแรก + ทุก 1 นาที
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 60 * 1000);

// ================= API =================
app.get("/api/summary", async (req, res) => {
  // ถ้ายังไม่มี cache → ดึงสด
  if (!cachedSummary) {
    const data = await fetchRealtimeData();

    if (!data) {
      return res.json({
        pvEnergy: 0,
        loadEnergy: 0,
        batCharge: 0,
        batDischarge: 0,
        gridImport: 0,
        gridExport: 0,
        outputFreq: 0,
        irradiance: 0,
        backplaneTemp: 0,
        co2Reduced: 0,
        ktoe: 0,
        source: "empty",
      });
    }

    return res.json({ ...data, source: "realtime" });
  }

  res.json({
    ...cachedSummary,
    lastUpdated,
  });
});

// routes อื่น
app.use("/api", hpsRoutes);

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
