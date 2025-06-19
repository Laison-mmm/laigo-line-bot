import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = JSON.parse(csv); // ✅ 改用 JSON，不是 .split(',')！

  const clean = str => String(str || '').replace(/\s/g, '').trim();

  // ✅ 只比對「姓名 + 電話」
  const matchedRows = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) =>
      clean(row[4]) === clean(order.name) &&
      clean(row[5]) === clean(order.phone)
    );

  if (matchedRows.length > 0) {
    const { row, index } = matchedRows.at(-1); // ✅ 取最後一筆
    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3;
      const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
      if (isEmpty) {
        return { type: 'repurchase', rowIndex: index + 1 }; // 注意：Sheet 是從 1 開始
      }
    }
    throw new Error('❌ 回購欄位已滿，無法再寫入');
  }

  // ✅ 新客 or 追蹤
  return { type: 'new', rowIndex: null };
}
