const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "data", "solar.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ SQLite connect error:", err.message);
  } else {
    console.log("✅ SQLite connected:", dbPath);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS pv_history (
      time INTEGER PRIMARY KEY,
      pvPower REAL,
      pvVoltage REAL,
      pvCurrent REAL
    )
  `);
});

module.exports = db;
