const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, "solar.db"));

db.prepare(`
  CREATE TABLE IF NOT EXISTS pv_history (
    time INTEGER PRIMARY KEY,
    pvPower REAL,
    pvVoltage REAL,
    pvCurrent REAL
  )
`).run();

module.exports = db;
