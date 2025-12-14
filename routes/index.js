const express = require("express");
const router = express.Router();

router.use(require("./history")); // 👈 เพิ่มบรรทัดนี้

module.exports = router;
