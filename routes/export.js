const express = require("express");
const router = express.Router();
const { fetchRealtimeData, saveToExcel } = require("./excelUtil");

router.get("/export", async (req, res) => {
  try {
    const data = await fetchRealtimeData();
    if (data) {
      await saveToExcel(data);
      res.status(200).json({ message: "✅ Exported to Excel successfully." });
    } else {
      res.status(500).json({ message: "❌ Failed to fetch data." });
    }
  } catch (error) {
    console.error("❌ Export error:", error);
    res.status(500).json({ message: "❌ Internal server error." });
  }
});

module.exports = router;
