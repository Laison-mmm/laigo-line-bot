// verifyCustomer.js  ‒ 嚴格三碼比對
import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  // 破快取：加時間戳
  const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv  = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  // ➜ 去空白／全形空白／零寬／全形轉半形／手機去 +886
  const cleanAll = (s = '') =>
    String(s)
      .replace(/[\s\u3000]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .normalize('NFKC')
      .replace(/^\+?886/, '0');

  const ig    = cleanAll(order.ig);
  const name  = cleanAll(order.name);
  const phone = cleanAll(order.phone);

  // **僅當三碼全對才算同客戶**
  const rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === ig &&
    cleanAll(r[4]) === name &&
    cleanAll(r[5]) === phone
  );

  // ------① 找不到：新客 / 追蹤 ------
  if (rowIndex === -1) {
    console.log('🆕 新客 / 追蹤 → 找不到三碼完全吻合的客戶', { ig, name, phone });
    return { type: 'new', rowIndex: null };
  }

  // ------② 找到了：回購 → 找右側空欄 ------
  const row = rows[rowIndex];
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;          // K~M, N~P...
    if (!row[base] && !row[base + 1] && !row[base + 2]) {
      return { type: 'repurchase', rowIndex: rowIndex + 1 };
    }
  }

  throw new Error('❌ 回購欄位已滿，無法再寫入');
}
