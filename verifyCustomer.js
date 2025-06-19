const axios = require('axios');

async function verifyCustomer(order) {
  const res = await axios.get(process.env.SHEET_API_URL);
  const rows = res.data;

  const match = rows.findIndex(row =>
    row[3]?.trim() === order.ig &&
    row[4]?.trim() === order.name &&
    row[5]?.trim().replace(/[-\s]/g, '') === order.phone
  );

  return match !== -1
    ? { type: 'repurchase', rowIndex: match + 1, startCol: findNextCol(rows[match]) }
    : { type: 'new', level: '', channel: 'IG' };
}

function findNextCol(row) {
  for (let i = 10; i < row.length; i += 3) {
    if (!row[i]) return i + 1;
  }
  return row.length + 1;
}

module.exports = { verifyCustomer };
