import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS    = 6;

/* ---------- 工具 ---------- */
const cleanAll = (s = '') =>
  String(s)
    .replace(/[\s\u3000]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC');

const normPhone = (s = '') => {
  const digits = s.replace(/\D/g, '');
  let p = digits.startsWith('886') ? digits.slice(3) : digits;
  if (p.length === 9) p = '0' + p;
  return p;
};

export async function verifyCustomer(order) {

  /* ---------- 1. 抓 CSV & 破快取 ---------- */
  const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');
  const rows = (await res.text()).trim().split('\n').map(r => r.split(','));

  /* ---------- 2. 三碼 ---------- */
  const ig    = cleanAll(order.ig);
  const name  = cleanAll(order.name);
  const phone = normPhone(order.phone);

  /* ---------- 3. 找目標 index（嚴格比對） ---------- */
  const idx = rows.findIndex(r =>
    cleanAll(r[3]) === ig &&
    cleanAll(r[4]) === name &&
    normPhone(r[5]) === phone
  );

  /* ---------- 4. 找不到 → 新客 / 追蹤 ---------- */
  if (idx === -1) {
    console.log('🆕 新客 / 追蹤：三碼完全對不到', { ig, name, phone });
    return { type: 'new', rowIndex: null };
  }

  /* ---------- 5. 真正有效列號（只算三碼任一有值的列） ---------- */
  const realRow = rows
    .slice(0, idx + 1)
    .filter(r => cleanAll(r[3]) || cleanAll(r[4]) || normPhone(r[5]))
    .length;                       // 1-based 給 Google Sheet

  /* ---------- 6. 回購：尋右側空欄 ---------- */
  const row = rows[idx];
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;      // K~M, N~P, …
    if (!row[base] && !row[base+1] && !row[base+2]) {
      return { type: 'repurchase', rowIndex: realRow };
    }
  }

  throw new Error('❌ 回購欄位已滿，無法再寫入');
}