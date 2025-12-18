const express = require("express");
const ExcelJS = require("exceljs");
const fs = require("fs-extra");
const path = require("path");

// LOG พิสูจน์ว่าไฟล์นี้ถูกโหลดจริง
console.log("✅ exportRoutes loaded");

const router = express.Router();

const DATA_DIR = path.resolve(__dirname, "../data");
const FILE_PATH = path.join(DATA_DIR, "solar_latest.xlsx");

// ===== helper: safe timestamp =====
function normalizeTimestamp(ts) {
  if (!ts) return new Date();

  // รองรับ "YYYY-MM-DD HH:mm:ss"
  const d = new Date(
    typeof ts === "string" ? ts.replace(" ", "T") : ts
  );

  if (isNaN(d.getTime())) {
    console.warn("⚠️ Invalid timestamp, fallback to now:", ts);
    return new Date();
  }

  return d;
}

router.get("/export/latest-excel", async (req, res) => {
  console.log("📥 /api/export/latest-excel called");

  try {
    const summary = req.app.get("cachedSummary");

    if (!summary) {
      console.log("⚠️ Summary not ready");
      return res.status(503).json({ error: "Summary not ready" });
    }

    await fs.ensureDir(DATA_DIR);

    const wb = new ExcelJS.Workbook();
    let ws;

    // ===== load or create workbook =====
    if (fs.existsSync(FILE_PATH)) {
      try {
        await wb.xlsx.readFile(FILE_PATH);
        ws = wb.getWorksheet("History");
      } catch (e) {
        console.warn("⚠️ Excel corrupted, recreating");
        ws = null;
      }
    }

    if (!ws) {
      console.log("🆕 Creating new Excel file / sheet");
      ws = wb.addWorksheet("History");
      ws.columns = [
        { header: "Timestamp", key: "timestamp" },
        { header: "PV Power (kW)", key: "pvPower" },
        { header: "PV Voltage (V)", key: "pvVoltage" },
        { header: "PV Current (A)", key: "pvCurrent" },
        { header: "PV Energy Today (kWh)", key: "pvEnergy" },
        { header: "Battery Charge (kWh)", key: "batCharge" },
        { header: "Battery Discharge (kWh)", key: "batDischarge" },
        { header: "Load Energy (kWh)", key: "loadEnergy" },
        { header: "Grid Import (kWh)", key: "gridImport" },
        { header: "Grid Export (kWh)", key: "gridExport" },
        { header: "Output Frequency (Hz)", key: "outputFreq" },
        { header: "Irradiance (W/m²)", key: "irradiance" },
        { header: "CO₂ Reduced (kg)", key: "co2Reduced" },
        { header: "KTOE", key: "ktoe" },
      ];
    }

    // ===== timestamp normalize =====
    const ts = normalizeTimestamp(summary.timestamp);
    const currentTsStr = ts.toISOString();

    // ===== duplicate guard =====
    const lastRow = ws.lastRow;
    const lastTsStr = lastRow?.getCell(1)?.value
      ? new Date(lastRow.getCell(1).value).toISOString()
      : null;

    if (lastTsStr !== currentTsStr) {
      ws.addRow({
        timestamp: currentTsStr,
        pvPower: summary.pvPower ?? 0,
        pvVoltage: summary.pvVoltage ?? 0,
        pvCurrent: summary.pvCurrent ?? 0,
        pvEnergy: summary.pvEnergy ?? 0,
        batCharge: summary.batCharge ?? 0,
        batDischarge: summary.batDischarge ?? 0,
        loadEnergy: summary.loadEnergy ?? 0,
        gridImport: summary.gridImport ?? 0,
        gridExport: summary.gridExport ?? 0,
        outputFreq: summary.outputFreq ?? 0,
        irradiance: summary.irradiance ?? 0,
        co2Reduced: summary.co2Reduced ?? 0,
        ktoe: summary.ktoe ?? 0,
      });

      console.log("➕ Row appended:", currentTsStr);
    } else {
      console.log("⏭️ Duplicate timestamp, skip append");
    }

    await wb.xlsx.writeFile(FILE_PATH);

    console.log("📤 Sending Excel:", FILE_PATH);
    res.download(FILE_PATH, "solar_latest.xlsx");
  } catch (err) {
    console.error("❌ Export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;
