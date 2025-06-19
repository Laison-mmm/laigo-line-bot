// verifyCustomer.js  – 嚴格三碼版（排除跳位根因）
import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;   // 仍用 CSV
const MAX_GROUPS     = 6;

export async function verifyCustomer(order) {

  // ① 破 Google CSV 快取
  const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  // ② 解析 CSV（split 先保留）
  const csv  = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  // ③ 極致清洗：空白 / 全形空白 / 零寬 / +886 / 全形數字
  const cleanAll = (s = '') =>
    String(s)
      .replace(/[\s\u3000]/g, '')                 // 半形＋全形空白
      .replace(/[\u200B-\u200D\uFEFF]/g, '')      // 零寬字元
      .normalize('NFKC')                          // 全形 → 半形
      .replace(/^\+?886/, '0')                    // +886 ➜ 0 開頭
      .trim();

  const ig    = cleanAll(order.ig);
  const name  = cleanAll(order.name);
  const phone = cleanAll(order.phone);

  // ④ 只接受「IG + 姓名 + 電話」三碼全中
  const rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === ig &&
    cleanAll(r[4]) === name &&
    cleanAll(r[5]) === phone
  );

  // ⑤ 找不到 ➜ 一律新客 / 追蹤（不追加行號）
  if (rowIndex === -1) {
    console.log('🆕 新客 / 追蹤：三碼完全對不到', { ig, name, phone });
    return { type: 'new', rowIndex: null };
  }

  // ⑥ 找到 ➜ 回購：尋右側空欄
  const row = rows[rowIndex];
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;          // K~M, N~P, ...
    if (!row[base] && !row[base+1] && !row[base+2]) {
      return { type: 'repurchase', rowIndex: rowIndex + 1 }; // 1-based
    }
  }

  throw new Error('❌ 回購欄位已滿，無法再寫入');
}
