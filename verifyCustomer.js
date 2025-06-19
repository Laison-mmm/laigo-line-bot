import fetch from 'node-fetch';
import { normalizePhone } from './utils.js';

const SHEET_URL = process.env.SHEET_API_URL;
const CSV_URL = process.env.SHEET_API_URL_CSV;

export default async function verifyCustomer(order) {
  if (!order.phone || !order.ig || !order.name || !order.inquiryDate) {
    throw new Error('❌ 欄位不足（verifyCustomer）');
  }

  // 1️⃣ 電話長度檢查：不足 10 碼直接退單
  const cleanPhone = normalizePhone(order.phone);
  if (cleanPhone.length < 10) {
    throw new Error('❌ 電話長度不足 10 碼');
  }

  order.level = '未定';

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const clean = str => normalizePhone(String(str || '').replace(/\s/g, ''));

  // 2️⃣ 三鍵比對（精準）
  const rowIndex = rows.findIndex((r, i) =>
    i > 0 && // 跳過標題列
    clean(r[3]) === clean(order.ig) &&
    clean(r[4]) === clean(order.name) &&
    clean(r[5]) === cleanPhone
  );

  if (rowIndex !== -1) {
    order.level = '已回購';
    order.rowIndex = rowIndex - 1; // 寫入用：扣掉表頭
    return order;
  }

  // 3️⃣ 新客／追蹤判斷（保留）
  const todayCode = getTodaySixDigit();
  order.level = order.inquiryDate === todayCode ? '新客' : '追蹤';
  return order;
}

function getTodaySixDigit() {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear().toString().slice(2)}${mm}${dd}`;
}
