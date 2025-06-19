import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  // ✅ 正確解析 CSV
  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const clean = str => String(str || '').replace(/\s/g, '').trim();

  // ✅ 比對「姓名 + 電話」
  const matchedRows = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) =>
      clean(row[4]) === clean(order.name) &&
      clean(row[5]) === clean(order.phone)
    );

  if (matchedRows.length > 0) {
    const { row, index } = matchedRows.at(-1); // ✅ 找到最後一筆相同的資料
    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3;
      const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
      if (isEmpty) {
        return { type: 'repurchase', rowIndex: index + 1 }; // 注意：rowIndex 是從 1 開始
      }
    }
    throw new Error('❌ 回購欄位已滿，無法再寫入');
  }

  // 🆕 沒找到，視為新客或追蹤
  return { type: 'new', rowIndex: null };
}
