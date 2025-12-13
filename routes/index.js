const express = require("express");
const dayjs = require("dayjs");
const router = express.Router();

const db = require("../db"); // 🔴 SQLite ที่เราสร้างไว้แล้ว

// ===================== HISTORY API =====================
// คืนข้อมูล PV Power / Voltage / Current ย้อนหลังทั้งหมด
router.get("/hps/history", (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT
          time,
          pvPower,
          pvVoltage,
          pvCurrent
        FROM pv_history
        ORDER BY time ASC
      `)
      .all();

    res.json({ data: rows });
  } catch (err) {
    console.error("❌ history error:", err.message);
    res.json({ data: [] });
  }
});

module.exports = router;
