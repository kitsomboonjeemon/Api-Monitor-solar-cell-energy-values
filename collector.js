const db = require("./db");
const fetchRealtime = require("./fetchRealtime");

const DEVICE_SN = "YKD0F1022A";

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function collectPV() {
  try {
    const d = await fetchRealtime(DEVICE_SN);

    const time = Date.now();
    const pvPower = toNumber(d.ppv);
    const pvVoltage = toNumber(d.vpv);
    const pvCurrent = toNumber(d.ipv);

    db.run(
      `INSERT OR IGNORE INTO pv_history
       (time, pvPower, pvVoltage, pvCurrent)
       VALUES (?, ?, ?, ?)`,
      [time, pvPower, pvVoltage, pvCurrent],
      (err) => {
        if (err) {
          console.error("❌ SQLite insert error:", err.message);
        } else {
          console.log("📥 PV saved", { pvPower, pvVoltage, pvCurrent });
        }
      }
    );
  } catch (e) {
    console.error("❌ collectPV error:", e.message);
  }
}

// run once at start
collectPV();

// every 6 minutes
setInterval(collectPV, 6 * 60 * 1000);
