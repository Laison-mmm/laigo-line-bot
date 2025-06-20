import fetch from 'node-fetch';
import Papa from 'papaparse';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

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
  if (p.length !== 10) {
    console.log(`❌ 手機號碼不足 10 碼: ${p}`);
    throw new Error('❌ 手機號碼不足 10 碼');
  }
  return p;
};

const formatOrderDate = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export async function verifyCustomer(order) {
  /* ---------- 1. 檢查環境變數 ---------- */
  if (!SHEET_CSV_URL) throw new Error('❌ SHEET_API_URL_CSV 未設定');

  /* ---------- 2. 抓 CSV & 破快取 ---------- */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 秒超時
  try {
    const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`❌ 無法讀取 Google Sheet: ${res.statusText}`);
    const csvText = await res.text();
    const { data: rows } = Papa.parse(csvText.trim(), { header: false });
    if (!rows.length) throw new Error('❌ CSV 資料為空');

    /* ---------- 3. 三碼 & 訂購日 ---------- */
    const ig = cleanAll(order.ig);
    const name = cleanAll(order.name);
    const phone = normPhone(order.phone);
    const orderDate = formatOrderDate(order.date);

    /* ---------- 4. 找目標 index（嚴格比對） ---------- */
    const idx = rows.findIndex(r =>
      cleanAll(r[3]) === ig &&
      cleanAll(r[4]) === name &&
      normPhone(r[5]) === phone
    );

    /* ---------- 5. 找不到 → 新客 ---------- */
    if (idx === -1) {
      console.log('🆕 新客：三碼完全對不到', { ig, name, phone, orderDate });
      return { type: 'new', rowIndex: null, orderDate, status: '新客' };
    }

    /* ---------- 6. 真正有效列號（只算三碼任一有值的列） ---------- */
    const realRow = rows
      .slice(0, idx + 1)
      .filter(r => cleanAll(r[3]) || cleanAll(r[4]) || normPhone(r[5]))
      .length; // 1-based 給 Google Sheet

    /* ---------- 7. 回購：尋右側空欄 ---------- */
    const row = rows[idx];
    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3; // K~M, N~P, …
      if (!row[base] && !row[base + 1] && !row[base + 2]) {
        return { type: 'repurchase', rowIndex: realRow, orderDate, status: '已回購' };
      }
    }

    throw new Error('❌ 回購欄位已滿，無法再寫入');
  } catch (error) {
    clearTimeout(timeout);
    throw new Error(`❌ 處理失敗: ${error.message}`);
  }
}
