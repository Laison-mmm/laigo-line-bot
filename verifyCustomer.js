import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const clean = str => String(str || '').replace(/\s/g, '').trim();
  const cleanAll = str =>
    clean(str)
      .normalize('NFKC') // 全形轉半形
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // 零寬符
      .replace(/[^\x00-\x7F\u4E00-\u9FFF\uFF00-\uFFEF]/g, ''); // 移除 emoji 等奇怪符號

  const orderIG = cleanAll(order.ig);
  const orderName = cleanAll(order.name);
  const orderPhone = cleanAll(order.phone);

  // ✅ 三碼比對（帳號、姓名、電話）
  let rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === orderIG &&
    cleanAll(r[4]) === orderName &&
    cleanAll(r[5]) === orderPhone
  );

  // ⛳ 若找不到，fallback 改為用「姓名 + 電話」補救（避免寫錯行）
  if (rowIndex === -1) {
    rowIndex = rows.findIndex(r =>
      cleanAll(r[4]) === orderName &&
      cleanAll(r[5]) === orderPhone
    );

    if (rowIndex !== -1) {
      console.warn('⚠️ IG 對不到，但電話+姓名對上，使用 fallback rowIndex');
    }
  }

  // 🧨 還是找不到 ➜ 回傳新客，留給 GAS 決定寫入哪
  if (rowIndex === -1) {
    console.warn('❗ 找不到該客戶，可能 CSV 未同步或資料髒');
    return { type: 'new', rowIndex: null };
  }

  // ✅ 回購情況：找右側空位寫入
  const row = rows[rowIndex];
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;
    const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
    if (isEmpty) {
      return { type: 'repurchase', rowIndex: rowIndex + 1 };
    }
  }

  throw new Error('❌ 回購欄位已滿，無法再寫入');
}
