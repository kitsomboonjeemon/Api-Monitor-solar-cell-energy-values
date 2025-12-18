const express = require("express");
const cors = require("cors");

const { fetchRealtimeData } = require("./routes/atessService");
const hpsRoutes = require("./routes/index");
const exportRoutes = require("./routes/export");

const app = express();
const PORT = 3001;

app.use(cors());

// ===== SUMMARY CACHE =====
let cachedSummary = null;

// ⭐ เพิ่มบรรทัดนี้
app.set("cachedSummary", null);

const fetchAndCacheSummary = async () => {
  try {
    const data = await fetchRealtimeData();
    if (data) {
      cachedSummary = data;

      // ⭐ สำคัญมาก
      app.set("cachedSummary", data);
    }
  } catch (err) {
    console.error("❌ fetchAndCacheSummary error:", err.message);
  }
};

// init + refresh every 6 minutes
fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 6 * 60 * 1000);

// ===== API =====
app.get("/api/summary", (req, res) => {
  res.json(
    cachedSummary || {
      pvEnergy: 0,
      loadEnergy: 0,
      batCharge: 0,
      batDischarge: 0,
      gridImport: 0,
      gridExport: 0,
      outputFreq: 0,
      source: "empty",
    }
  );
});

app.use("/api", exportRoutes);
app.use("/api", hpsRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
