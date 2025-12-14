const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * GET /api/hps/history
 */
router.get("/hps/history", (req, res) => {
  console.log("🔥 HIT /api/hps/history");

  db.all(
    `
    SELECT
      time,
      pvPower,
      pvVoltage,
      pvCurrent
    FROM pv_history
    ORDER BY time ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("❌ SQLite error:", err.message);
        return res.json({ data: [] });
      }

      console.log("📊 rows:", rows.length);
      res.json({ data: rows });
    }
  );
});

module.exports = router;
