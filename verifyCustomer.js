// verifyCustomer.js  – CSV 版（嚴格三碼 + 防跳位 + default export）

import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV; // Google Sheet CSV 下載網址
const MAX_GROUPS    = 6;                              // 6 組回購欄：K~M、N~P…

/* ---------- 通用工具 ---------- */
const cleanAll = (s = '') =>
  String(s)
    .replace(/[\s\u3000]/g, '')                 // 半形 + 全形空白
    .replace(/[\u200B-\u200D\uFEFF]/g, '')      // 零寬字元
    .normalize('NFKC');                         // 全形 → 半形（含數字）

const normPhone = (s = '') => {
  const digits = String(s).replace(/\D/g, '');
  let p = digits.startsWith('886') ? digits.slice(3) : digits;
  if (p.length === 9) p = '0' + p;              // 918… → 0918…
  return p;
};

/**
 * 依三碼 (IG+姓名+電話) 找客戶行，並決定回購或新客
 * @param  {object} order  { ig, name, phone, … }
 * @return {object}        { type: 'new'|'repurchase', rowIndex: null|number }
 */
export default async function verifyCustomer(order) {

  /* 1. 抓最新 CSV（加亂數參數破快取） */
  const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');
  const rows = (await res.text()).trim().split('\n').map(r => r.split(','));

  /* 2. 取三碼並清洗 */
  const ig    = cleanAll(order.ig);
  const name  = cleanAll(order.name);
  const phone = normPhone(order.phone);

  /* 3. 嚴格三碼比對，找到目標索引 idx (0-based) */
  const idx = rows.findIndex(r =>
    cleanAll(r[3]) === ig &&
    cleanAll(r[4]) === name &&
    normPhone(r[5]) === phone
  );

  /* 4. 找不到 → 新客 / 追蹤 */
  if (idx === -1) {
    console.log('🆕 新客 / 追蹤：三碼完全對不到', { ig, name, phone });
    return { type: 'new', rowIndex: null };
  }

  /* 5. 計算「真正有效行號」：只統計三碼任一有值的列 */
  const realRow = rows
    .slice(0, idx + 1)
    .filter(r => cleanAll(r[3]) || cleanAll(r[4]) || normPhone(r[5]))
    .length;                             // 1-based，給 Google Sheet

  /* 6. 回購：尋右側第一組空欄 (K~M、N~P…) */
  const row = rows[idx];
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;             // K = 10, N = 13 …
    if (!row[base] && !row[base + 1] && !row[base + 2]) {
      return { type: 'repurchase', rowIndex: realRow };
    }
  }

  /* 7. 若 6 組都滿 → 拋錯 */
  throw new Error('❌ 回購欄位已滿，無法再寫入');
}
