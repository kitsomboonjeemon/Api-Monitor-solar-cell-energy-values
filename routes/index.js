const express = require("express");
const router = express.Router();
const db = require("../db");

// =====================
// PV HISTORY (SQLite)
// =====================
router.get("/hps/history", (req, res) => {
  const sql = `
    SELECT
      time,
      pvPower,
      pvVoltage,
      pvCurrent
    FROM pv_history
    ORDER BY time ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ history db error:", err.message);
      return res.status(500).json({ data: [] });
    }

    // 🔴 จุดสำคัญ: ต้องเป็น array เสมอ
    res.json({ data: rows || [] });
  });
});

module.exports = router;
