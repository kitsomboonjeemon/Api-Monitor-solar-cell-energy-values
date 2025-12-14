const express = require("express");
const router = express.Router();

const historyRoutes = require("./history");

// 🔥 ใส่ prefix ให้ชัด
router.use("/hps", historyRoutes);

module.exports = router;
