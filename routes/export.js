const express = require("express");
const ExcelJS = require("exceljs");
const fs = require("fs-extra");
const path = require("path");

console.log("✅ exportRoutes loaded");

const router = express.Router();
const DATA_DIR = path.resolve(__dirname, "../data");
const FILE_PATH = path.join(DATA_DIR, "solar_latest.xlsx");

function safeDate(ts) {
  if (!ts) return new Date();
  const d = new Date(String(ts).replace(" ", "T"));
  return isNaN(d.getTime()) ? new Date() : d;
}

router.get("/export/latest-excel", async (req, res) => {
  try {
    const summary = req.app.get("cachedSummary");
    if (!summary) {
      return res.status(503).json({ error: "Summary not ready" });
    }

    await fs.ensureDir(DATA_DIR);

    const wb = new ExcelJS.Workbook();
    let ws;

    // ===== load workbook safely =====
    if (fs.existsSync(FILE_PATH)) {
      try {
        await wb.xlsx.readFile(FILE_PATH);
        ws = wb.getWorksheet("History");
      } catch {
        // ไฟล์พัง → ลบทิ้ง แล้วเริ่มใหม่
        await fs.remove(FILE_PATH);
        ws = null;
      }
    }

    // ===== create workbook/sheet once =====
    if (!ws) {
      ws = wb.addWorksheet("History");
      ws.columns = [
        { header: "Timestamp", key: "timestamp" },
        { header: "PV Power", key: "pvPower" },
        { header: "PV Voltage", key: "pvVoltage" },
        { header: "PV Current", key: "pvCurrent" },
        { header: "PV Energy", key: "pvEnergy" },
        { header: "Battery Charge", key: "batCharge" },
        { header: "Battery Discharge", key: "batDischarge" },
        { header: "Load Energy", key: "loadEnergy" },
        { header: "Grid Import", key: "gridImport" },
        { header: "Grid Export", key: "gridExport" },
        { header: "Output Freq", key: "outputFreq" },
        { header: "Irradiance", key: "irradiance" },
        { header: "CO2 Reduced", key: "co2Reduced" },
        { header: "KTOE", key: "ktoe" },
      ];
    }

    const ts = safeDate(summary.timestamp).toISOString();

    const lastTs =
      ws.lastRow?.getCell(1)?.value &&
      new Date(ws.lastRow.getCell(1).value).toISOString();

    if (lastTs !== ts) {
      ws.addRow({
        timestamp: ts,
        pvPower: Number(summary.pvPower) || 0,
        pvVoltage: Number(summary.pvVoltage) || 0,
        pvCurrent: Number(summary.pvCurrent) || 0,
        pvEnergy: Number(summary.pvEnergy) || 0,
        batCharge: Number(summary.batCharge) || 0,
        batDischarge: Number(summary.batDischarge) || 0,
        loadEnergy: Number(summary.loadEnergy) || 0,
        gridImport: Number(summary.gridImport) || 0,
        gridExport: Number(summary.gridExport) || 0,
        outputFreq: Number(summary.outputFreq) || 0,
        irradiance: Number(summary.irradiance) || 0,
        co2Reduced: Number(summary.co2Reduced) || 0,
        ktoe: Number(summary.ktoe) || 0,
      });
    }

    await wb.xlsx.writeFile(FILE_PATH);
    res.download(FILE_PATH, "solar_latest.xlsx");
  } catch (err) {
    console.error("❌ EXPORT FAILED:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;
