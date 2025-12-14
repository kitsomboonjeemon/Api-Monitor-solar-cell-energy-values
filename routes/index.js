const express = require("express");
const router = express.Router();
const db = require("../db");

// ================= PV HISTORY (SQLite) =================
router.get("/hps/history", (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.json({ data: [] });
  }

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;

  const sql = `
    SELECT
      time,
      pvPower,
      pvVoltage,
      pvCurrent
    FROM pv_history
    WHERE time BETWEEN ? AND ?
    ORDER BY time ASC
  `;

  db.all(sql, [start, end], (err, rows) => {
    if (err) {
      console.error("❌ pv_history error:", err.message);
      return res.status(500).json({ data: [] });
    }
    res.json({ data: rows });
  });
});

module.exports = router;
