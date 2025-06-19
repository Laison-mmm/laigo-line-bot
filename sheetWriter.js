import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const START_COL = 11; // K 欄 = 第 11 欄（index = 11）
const MAX_GROUPS = 6;

export default async function writeToSheet(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const clean = str => String(str || '').replace(/\s/g, '');
  const rowIndex = rows.findIndex(r =>
    clean(r[3]) === clean(order.ig) &&
    clean(r[4]) === clean(order.name) &&
    clean(r[5]) === clean(order.phone)
  );

  // ✅ 若找到回購行，直接寫入右側欄位
  if (rowIndex !== -1) {
    const row = rows[rowIndex];
    for (let g = 0; g < MAX_GROUPS; g++) {
      const start = START_COL + g * 3;
      if (!row[start] && !row[start + 1] && !row[start + 2]) {
        const payload = {
          type: 'repurchase',
          rowIndex: rowIndex + 1, // GAS 是 1-based
          startCol: start + 1,     // GAS 是 1-based
          orderDate: order.orderDate,
          product: '雙藻🌿',
          quantity: order.quantity
        };
        return await postToSheet(payload);
      }
    }
    throw new Error('❌ 回購欄位已滿');
  }

  // ✅ 新客 or 追蹤 ➜ 新增一整列
  const payload = {
    type: 'new',
    level: order.level,
    channel: 'IG',
    inquiryDate: order.inquiryDate,
    ig: order.ig,
    name: order.name,
    phone: order.phone,
    orderDate: order.orderDate,
    product: '雙藻🌿',
    quantity: order.quantity,
    notes: order.notes
  };

  return await postToSheet(payload);
}

async function postToSheet(payload) {
  const res = await fetch(SHEET_WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log('📤 GAS 回應：', text);
  if (!res.ok || text.includes('❌')) throw new Error(text);
  return text;
}
