const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());

// routes อื่น (history / graph)
const hpsRoutes = require("./routes/index");

// ✅ ดึงจาก excelUtil.js
const { fetchRealtimeData } = require("./routes/excelUtil");

console.log("🔥 fetchRealtimeData =", fetchRealtimeData);

// ================= SUMMARY CACHE =================
let cachedSummary = null;
let lastUpdated = null;

const fetchAndCacheSummary = async () => {
  try {
    console.log("🔁 fetchAndCacheSummary running...");

    const data = await fetchRealtimeData();
    console.log("📦 realtime data =", data);

    if (data) {
      cachedSummary = {
        pvEnergy: data.pvEnergy ?? 0,
        loadEnergy: data.loadEnergy ?? 0,
        batCharge: data.batCharge ?? 0,
        batDischarge: data.batDischarge ?? 0,
        gridImport: data.gridImport ?? 0,
        gridExport: data.gridExport ?? 0,
        outputFreq: data.outputFreq ?? 0,
        irradiance: data.irradiance ?? 0,
        backplaneTemp: data.backplaneTemp ?? 0,
        co2Reduced: data.co2Reduced ?? 0,
        ktoe: data.ktoe ?? 0,
        source: "cache",
      };

      lastUpdated = new Date().toISOString();
      console.log("✅ Summary cached @", lastUpdated);
    } else {
      console.log("⚠️ fetchRealtimeData returned null");
    }
  } catch (err) {
    console.error("❌ fetchAndCacheSummary error:", err);
  }
};

// 🔁 ดึงครั้งแรก + ทุก 1 นาที
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 60 * 1000);

// ================= API =================
app.get("/api/summary", async (req, res) => {
  console.log("🌐 /api/summary called");

  // ถ้ายังไม่มี cache → ดึงสด
  if (!cachedSummary) {
    console.log("⚠️ cache empty → fetch realtime");

    const data = await fetchRealtimeData();
    console.log("📦 realtime (direct) =", data);

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
