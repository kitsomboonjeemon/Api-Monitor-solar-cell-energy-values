const express = require("express");
const router = express.Router();

const historyRoutes = require("./history");

// ⭐ สำคัญมาก
router.use("/hps", historyRoutes);

module.exports = router;
