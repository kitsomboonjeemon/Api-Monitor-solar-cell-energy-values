const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// ✅ บังคับใช้ DB ตัวเดียวกับที่คุณใช้ sqlite3
const dbPath = path.resolve(process.cwd(), "data", "solar.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ SQLite error:", err.message);
  } else {
    console.log("✅ SQLite connected:", dbPath);
  }
});

module.exports = db;
