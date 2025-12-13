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

    db.prepare(`
      INSERT OR IGNORE INTO pv_history
      (time, pvPower, pvVoltage, pvCurrent)
      VALUES (?, ?, ?, ?)
    `).run(
      Date.now(),
      toNumber(d.ppv),
      toNumber(d.vpv),
      toNumber(d.ipv)
    );

    console.log("📥 PV saved");
  } catch (e) {
    console.error("collectPV error:", e.message);
  }
}

// เก็บทันที
collectPV();

// ทุก 6 นาที
setInterval(collectPV, 6 * 60 * 1000);
