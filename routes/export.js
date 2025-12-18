const express = require("express");
const ExcelJS = require("exceljs");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

const DATA_DIR = path.resolve(__dirname, "../data");
const FILE_PATH = path.join(DATA_DIR, "solar_latest.xlsx");

router.get("/export/latest-excel", async (req, res) => {
  try {
    const summary = req.app.get("cachedSummary");
    if (!summary) {
      return res.status(503).json({ error: "Summary not ready" });
    }

    await fs.ensureDir(DATA_DIR);

    const wb = new ExcelJS.Workbook();
    let ws;

    if (fs.existsSync(FILE_PATH)) {
      await wb.xlsx.readFile(FILE_PATH);
      ws = wb.getWorksheet("History");

      // ⭐ fallback ถ้า sheet หาย
      if (!ws) {
        ws = wb.addWorksheet("History");
      }
    } else {
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

    // ===== ป้องกัน timestamp ซ้ำ (normalize) =====
    const lastRow = ws.lastRow;
    const lastTimestamp = lastRow?.getCell(1)?.value;
    const lastTsStr = lastTimestamp
      ? new Date(lastTimestamp).toISOString()
      : null;

    const currentTsStr = new Date(summary.timestamp).toISOString();

    if (lastTsStr !== currentTsStr) {
      ws.addRow({
        timestamp: summary.timestamp,
        pvPower: summary.pvPower,
        pvVoltage: summary.pvVoltage,
        pvCurrent: summary.pvCurrent,
        pvEnergy: summary.pvEnergy,
        batCharge: summary.batCharge,
        batDischarge: summary.batDischarge,
        loadEnergy: summary.loadEnergy,
        gridImport: summary.gridImport,
        gridExport: summary.gridExport,
        outputFreq: summary.outputFreq,
        irradiance: summary.irradiance,
        co2Reduced: summary.co2Reduced,
        ktoe: summary.ktoe,
      });
    }

    await wb.xlsx.writeFile(FILE_PATH);
    res.download(FILE_PATH, "solar_latest.xlsx");
  } catch (err) {
    console.error("❌ Export error:", err.message);
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;
