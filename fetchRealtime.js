const axios = require("axios");

const BASE_URL = "https://www.enerclo-atesspower.com/api/v1";
const AUTH_HEADER = {
  Authorization: "Basic MTcxOTpjOTAyNGVmMjA5ZWU0ZWFhOTgyYWQ2YWQ2NTQxZDlhYg==",
  "Accept-Language": "en",
};

async function fetchRealtime(deviceSn) {
  const res = await axios.get(`${BASE_URL}/hps/data-last`, {
    params: { deviceSn },
    headers: AUTH_HEADER,
    timeout: 10000,
  });
  return res.data?.data || {};
}

module.exports = fetchRealtime;
