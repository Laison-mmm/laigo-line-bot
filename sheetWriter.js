import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const SHEET_NAME = 'Q2買賣';
const PRODUCT_NAME = '雙藻🌿';
const CHANNEL = 'IG';
const MAX_GROUPS = 6; // 每筆最多 6 次回購

export async function writeToSheet(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const clean = str => String(str || '').replace(/\s/g, '');
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const rowIndex = rows.findIndex(r =>
    clean(r[3]) === clean(order.ig) ||
    clean(r[4]) === clean(order.name) ||
    clean(r[5]) === clean(order.phone)
  );

  // ⛔ 檢查必要欄位
  if (!order.ig || !order.name || !order.phone || !order.inquiryDate || !order.quantity) {
    throw new Error('❌ 資料不足（共用檢查）');
  }

  // ✅ 資料清單
  const payload = {
    sheetName: SHEET_NAME,
    data: {
      channel: CHANNEL,
      ig: order.ig,
      name: order.name,
      phone: order.phone,
      inquiryDate: order.inquiryDate,
      orderDate: today,
      quantity: parseQuantity(order.quantity),
      product: PRODUCT_NAME,
      notes: order.notes || '',
    }
  };

  if (rowIndex !== -1) {
    // ✅ 已回購：寫入右側空欄，更新主欄為「已回購」
    payload.mode = 'appendRight';
    payload.data.row = rowIndex + 1; // 1-based index
    return post(payload);
  }

  // 🟡 新客 or 追蹤
  const isToday = isTodayInquiry(order.inquiryDate);
  payload.mode = 'appendNew';
  payload.data.level = isToday ? '新客' : '追蹤';
  return post(payload);
}

function parseQuantity(qtyText) {
  const map = { '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  const match = String(qtyText).match(/([一二兩三四五六七八九十]|\d+)/);
  if (!match) return 1;
  const token = match[1];
  return isNaN(token) ? map[token] || 1 : Number(token);
}

function isTodayInquiry(code) {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  return String(code).includes(mmdd);
}

async function post(payload) {
  const res = await fetch(SHEET_WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('❌ 寫入表單失敗（Google Apps Script）');
  return await res.json();
}
