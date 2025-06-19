// ✅ 完整修正版 sheetWriter.js
import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const START_COL = 11;
const MAX_GROUPS = 6;

export default async function writeToSheet(order) {
  // 補值保險
  order.level = order.level || '追蹤';
  order.channel = order.channel || 'IG';
  order.orderDate = order.orderDate || getTodayDate();
  order.product = order.product || '雙藻🌿';
  order.notes = order.notes || '';

  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');
  const csv = await res.text();
  const rows = csv.trim().split('\n').map(row => row.split(','));

  const rowIndex = rows.findIndex(r =>
    r[3] === order.ig && r[4] === order.name && r[5] === order.phone
  );

  if (rowIndex !== -1) {
    const row = rows[rowIndex];
    for (let g = 0; g < MAX_GROUPS; g++) {
      const start = START_COL + g * 3;
      if (!row[start] && !row[start + 1] && !row[start + 2]) {
        const payload = {
          type: 'repurchase',
          rowIndex,
          startCol: start + 1,
          orderDate: order.orderDate,
          product: order.product,
          quantity: order.quantity
        };
        return await postToSheet(payload);
      }
    }
    throw new Error('❌ 回購欄位已滿');
  }

  const payload = {
    type: 'new',
    level: order.level,
    channel: order.channel,
    inquiryDate: order.inquiryDate,
    ig: order.ig,
    name: order.name,
    phone: order.phone,
    orderDate: order.orderDate,
    product: order.product,
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

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
