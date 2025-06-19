import fetch from 'node-fetch';

const SHEET_URL = process.env.SHEET_API_URL; // 用於 POST 寫入
const CSV_URL = process.env.SHEET_API_URL_CSV; // 用於 GET 取得試算表資料

export default async function verifyCustomer(order) {
  if (!order.phone || !order.ig || !order.name || !order.inquiryDate) {
    throw new Error('❌ 欄位不足（verifyCustomer）');
  }

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  // 🔧 修正：標準化比對（清掉空白、斷行）
  const clean = str => String(str || '').replace(/\s/g, '');

  const rowIndex = rows.findIndex(r =>
    clean(r[3]) === clean(order.ig) &&
    clean(r[4]) === clean(order.name) &&
    clean(r[5]) === clean(order.phone)
  );

  if (rowIndex !== -1) {
    order.level = '已回購';
    order.rowIndex = rowIndex;
    return order;
  }

  // 判斷新客 or 追蹤
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
