const express = require("express");
const cors = require("cors");

const { fetchRealtimeSummary } = require("./routes/atessService");
const hpsRoutes = require("./routes/index");

const app = express();
const PORT = 3001;

app.use(cors());

let cachedSummary = null;
const DEVICE_SN = "YKD0F1022A";

const fetchAndCacheSummary = async () => {
  const data = await fetchRealtimeSummary(DEVICE_SN);
  if (data) cachedSummary = data;
};


fetchAndCacheSummary();
setInterval(fetchAndCacheSummary, 6 * 60 * 1000);

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
