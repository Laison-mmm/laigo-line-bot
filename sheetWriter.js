const axios = require('axios');

async function writeToSheet(data) {
  try {
    const res = await axios.post(process.env.SHEET_API_URL, data);
    return res.data;
  } catch (err) {
    return '❌ 寫入失敗：' + err.message;
  }
}

module.exports = { writeToSheet };
