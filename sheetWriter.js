import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const SHEET_NAME = 'Q2買賣';
const PRODUCT_NAME = '雙藻🌿';
const CHANNEL = 'IG';
const MAX_GROUPS = 6; // 最多支援 6 次回購（3欄 × 6組）

export async function writeToSheet(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));
  const clean = str => String(str || '').replace(/\s/g, '');

  // ✅ 改為 M/D 格式
  const now = new Date();
  const today = `${now.getMonth() + 1}/${now.getDate()}`;

  const rowIndex = rows.findIndex(r =>
    clean(r[3]) === clean(order.ig) ||
    clean(r[4]) === clean(order.name) ||
    clean(r[5]) === clean(order.phone)
  );

  if (!order.ig || !order.name || !order.phone || !order.inquiryDate || !order.quantity) {
    throw new Error('❌ 資料不足（共用檢查）');
  }

  const payload = {
    mode: '',
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
    // ✅ 回購 ➜ 指定寫入行
    payload.mode = 'appendRight';
    payload.data.row = rowIndex + 1;

    console.log('🔁 回購資料送出:', payload);
    const resultText = await send(payload);
    return resultText;
  }

  // 🟡 新客 / 追蹤 ➜ 判斷是否今天
  const isToday = isTodayInquiry(order.inquiryDate);
  payload.mode = 'appendNew';
  payload.data.level = isToday ? '新客' : '追蹤';

  console.log('🆕 新客資料送出:', payload);
  const resultText = await send(payload);
  return resultText;
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

async function send(payload) {
  const res = await fetch(SHEET_WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const resultText = await res.text();
  console.log('📄 GAS 回傳結果:', resultText);

  if (!resultText.includes('✅')) {
    throw new Error(resultText || '❌ GAS 無明確回應');
  }
  return resultText;
}
