// ✅ 修正版 verifyCustomer.js
import fetch from 'node-fetch';

const SHEET_URL = process.env.SHEET_API_URL;
const CSV_URL = process.env.SHEET_API_URL_CSV;

export default async function verifyCustomer(order) {
  if (!order.phone || !order.ig || !order.name || !order.inquiryDate) {
    throw new Error('❌ 欄位不足（新客）');
  }

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('❌ 讀取表格失敗');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const rowIndex = rows.findIndex(r =>
    r[3] === order.ig && r[4] === order.name && r[5] === order.phone
  );

  if (rowIndex !== -1) {
    order.level = '已回購';
    order.rowIndex = rowIndex;
    return order;
  }

  // 判斷是新客 or 追蹤
  const todayStr = getTodaySixDigit();
  order.level = order.inquiryDate === todayStr ? '新客' : '追蹤';

  return order;
}

function getTodaySixDigit() {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear().toString().slice(2)}${mm}${dd}`;
}
