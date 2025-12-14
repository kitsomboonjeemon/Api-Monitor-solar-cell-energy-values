const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/hps/history
router.get("/history", (req, res) => {
  console.log("🔥 HIT /api/hps/history");

  const sql = `
    SELECT time, pvPower, pvVoltage, pvCurrent
    FROM pv_history
    ORDER BY time ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ history db error:", err.message);
      return res.status(500).json({ data: [] });
    }

    console.log("📊 rows length:", rows.length);

    res.json({ data: rows });
  });
});

module.exports = router;
