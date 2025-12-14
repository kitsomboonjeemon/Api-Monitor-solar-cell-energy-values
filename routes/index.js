const express = require("express");
const router = express.Router();

// 🔹 route อื่น ๆ ที่มีอยู่แล้ว
// const xxx = require("./xxx");

// ✅ เพิ่มบรรทัดนี้
const historyRoutes = require("./history");

// ===== mount =====
router.use(historyRoutes);

module.exports = router;
