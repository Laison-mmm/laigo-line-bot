import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const clean = str => String(str || '').replace(/\s/g, '').trim();

  // ✅ 改為：姓名 + 電話 比對，不看 IG（防止 IG 欄為空）
  const matchedRows = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) =>
      clean(row[4]) === clean(order.name) &&
      clean(row[5]) === clean(order.phone)
    );

  if (matchedRows.length > 0) {
    const { row, index } = matchedRows.at(-1); // ✅ 最後一筆為主

    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3; // K欄開始（第11欄 index = 10）
      const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
      if (isEmpty) {
        return { type: 'repurchase', rowIndex: index + 1 };
      }
    }

    throw new Error('❌ 回購欄位已滿，無法再寫入');
  }

  // ✅ 找不到匹配 ➜ 新客
  return { type: 'new', rowIndex: null };
}
