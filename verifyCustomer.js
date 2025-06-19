// verifyCustomer.js  ‒ CSV 強化版
import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  // 破除 Google Sheet CSV 快取 ➜ 加亂數參數
  const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv  = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  // 全面清洗：空白／全形空白／零寬／+886／全形轉半形
  const cleanAll = (s = '') =>
    String(s)
      .replace(/[\s\u3000]/g, '')                 // 半形＋全形空格
      .replace(/[\u200B-\u200D\uFEFF]/g, '')      // 零寬字元
      .normalize('NFKC')                          // 全形 → 半形
      .replace(/^\+?886/, '0')                    // +886 ➜ 0
      .trim();

  const ig    = cleanAll(order.ig);
  const name  = cleanAll(order.name);
  const phone = cleanAll(order.phone);

  // ① 嚴格比對：IG＋姓名＋電話
  let rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === ig &&
    cleanAll(r[4]) === name &&
    cleanAll(r[5]) === phone
  );

  // ② fallback：姓名＋電話
  if (rowIndex === -1) {
    rowIndex = rows.findIndex(r =>
      cleanAll(r[4]) === name &&
      cleanAll(r[5]) === phone
    );
    if (rowIndex !== -1) console.warn('⚠️ IG 未命中，fallback by name+phone');
  }

  // ③ 最後防線：電話
  if (rowIndex === -1) {
    rowIndex = rows.findIndex(r => cleanAll(r[5]) === phone);
    if (rowIndex !== -1) console.warn('⚠️ fallback by phone only');
  }

  // 找不到 ➜ 視為新客
  if (rowIndex === -1) {
    console.warn('❗ 找不到客戶，將視為新客', { ig, name, phone });
    return { type: 'new', rowIndex: null };
  }

  // 找到 ➜ 回購，找右側空欄
  const row = rows[rowIndex];
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;          // K~M, N~P...
    if (!row[base] && !row[base + 1] && !row[base + 2]) {
      return { type: 'repurchase', rowIndex: rowIndex + 1 };
    }
  }

  throw new Error('❌ 回購欄位已滿，無法再寫入');
}
