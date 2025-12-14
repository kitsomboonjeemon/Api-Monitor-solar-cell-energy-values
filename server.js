const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());

const hpsRoutes = require("./routes/index");

// ===== Summary Cache =====
let cachedSummary = null;

const fetchAndCacheSummary = async () => {
  // TODO: ดึง summary จาก Atess ตรง ๆ หรือ endpoint อื่น
};

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

app.use("/api", hpsRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
