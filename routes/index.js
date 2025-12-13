const express = require("express");
const axios = require("axios");
const dayjs = require("dayjs");

const router = express.Router();

const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};

// ===================== UTIL =====================
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toTime = (t) => {
  if (!t) return null;
  const d = dayjs(t.replace(" ", "T"));
  return d.isValid() ? d.valueOf() : null;
};

const getDeviceSn = (req) =>
  req.query.deviceSn || "YKD0F1022A";

// ===================== HISTORY (PV GRAPH) =====================
router.get("/hps/history", async (req, res) => {
  const deviceSn = getDeviceSn(req);

  // ⭐ สำคัญที่สุด: Atess ต้องการวันที่
  const startDate = req.query.startDate || dayjs().format("YYYY-MM-DD");
  const endDate   = req.query.endDate   || startDate;

  const pageSize = 200;
  let pageNo = 1;
  const all = [];

  try {
    while (true) {
      const r = await axios.get(`${BASE_URL}/hps/data-list-small`, {
        params: {
          deviceSn,
          startDate,
          endDate,
          pageNo,
          pageSize,
        },
        headers: AUTH_HEADER,
        timeout: 20000,
      });

      const rows = r.data?.data?.datas || [];
      all.push(...rows);

      if (rows.length < pageSize) break;
      pageNo++;
    }

    const transformed = all
      .map((item) => {
        const time = toTime(item.recordTime);
        if (!time) return null;

        return {
          time,
          pvPower: toNumber(item.ppv),   // PV power (kW)
          pvVoltage: toNumber(item.vpv), // PV voltage (V)
          pvCurrent: toNumber(item.ipv), // PV current (A)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);

    res.json({ data: transformed });
  } catch (err) {
    console.error("❌ history error:", err.message);
    res.json({ data: [] });
  }
});

module.exports = router;
