import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL;
const SHEET_WRITE_URL = process.env.SHEET_API_URL; // 同一個 GAS，POST 寫入

const START_COL = 11; // K 欄 = index 11
const MAX_GROUPS = 6; // 最多 6 組回購欄位

export default async function writeToSheet(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(row => row.split(','));

  // 比對主鍵
  const rowIndex = rows.findIndex(r =>
    r[3] === order.ig && r[4] === order.name && r[5] === order.phone
  );

  // ✅ 是回購
  if (rowIndex !== -1) {
    const row = rows[rowIndex];

    for (let g = 0; g < MAX_GROUPS; g++) {
      const start = START_COL + g * 3; // 每組三欄（訂購日, 產品, 盒數）
      if (!row[start] && !row[start + 1] && !row[start + 2]) {
        // 找到空格，準備寫入
        const payload = {
          type: 'repurchase',
          rowIndex,
          startCol: start + 1, // GAS 是 1-based index
          orderDate: order.orderDate,
          product: '雙藻🌿',
          quantity: order.quantity
        };

        return await postToSheet(payload);
      }
    }

    throw new Error('❌ 回購欄位已滿');
  }

  // ✅ 新客 or 追蹤 ➜ 寫入 A~J 欄
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
    notes: order.notes,
  };

  return await postToSheet(payload);
}

async function postToSheet(payload) {
  const res = await fetch(SHEET_WRITE_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });

  const text = await res.text();
  console.log('📤 GAS 回應：', text);

  if (!res.ok || text.includes('❌')) throw new Error(text);
  return text;
}
