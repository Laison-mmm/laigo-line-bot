import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV; // Google Sheet CSV 下載網址
const MAX_GROUPS    = 6;                              // 6 組回購欄：K~M、N~P、…

/**
 * 取得客戶行號與回購狀態
 * @param {object} order  { ig, name, phone, ... }
 * @return {object}       { type: 'new'|'repurchase', rowIndex: null|number }
 */
export async function verifyCustomer(order) {
  /* ---------- 1. 破快取：為 CSV URL 加亂數參數 ---------- */
  const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  /* ---------- 2. 解析 CSV（split 依舊，結構不動） ---------- */
  const csv  = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  /* ---------- 3. 工具：字串清洗 & 電話正規化 ---------- */
  const cleanAll = (s = '') =>
    String(s)
      .replace(/[\s\u3000]/g, '')                 // 半形 + 全形空白
      .replace(/[\u200B-\u200D\uFEFF]/g, '')      // 零寬字元
      .normalize('NFKC');                         // 全形 → 半形（含數字）

  const normPhone = (s = '') => {
    const digits = String(s).replace(/\D/g, '');              // 留數字
    let p = digits.startsWith('886') ? digits.slice(3) : digits; // 去 +886
    if (p.length === 9) p = '0' + p;                          // 918… → 0918…
    return p;
  };

  /* ---------- 4. 三碼（IG+姓名+電話）嚴格比對 ---------- */
  const ig    = cleanAll(order.ig);
  const name  = cleanAll(order.name);
  const phone = normPhone(order.phone);

  const rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === ig &&
    cleanAll(r[4]) === name &&
    normPhone(r[5]) === phone
  );

  /* ---------- 5. 找不到：新客 / 追蹤 ---------- */
  if (rowIndex === -1) {
    console.log('🆕 新客 / 追蹤：三碼完全對不到', { ig, name, phone });
    return { type: 'new', rowIndex: null };       // 交給 writeToSheet 走 append 流程
  }

  /* ---------- 6. 找到：回購 → 尋右側空欄 ---------- */
  const row = rows[rowIndex];
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;                      // K = 10 → KLM；N = 13 → NOP…
    if (!row[base] && !row[base + 1] && !row[base + 2]) {
      return { type: 'repurchase', rowIndex: rowIndex + 1 }; // 1-based for Google Sheet
    }
  }

  /* ---------- 7. 滿載保護 ---------- */
  throw new Error('❌ 回購欄位已滿，無法再寫入');
}
