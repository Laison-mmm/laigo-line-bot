import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.map(c => c.trim()));
  const clean = str => String(str || '').replace(/\s/g, '');

  // ✅ 比對 IG or 姓名 or 電話（任一命中即算）
  const matchedRows = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) => {
      const hasAnyMatch =
        clean(row[3]) === clean(order.ig) ||
        clean(row[4]) === clean(order.name) ||
        clean(row[5]) === clean(order.phone);
      const notEmpty = row[3] || row[4] || row[5]; // 排除空白列
      return hasAnyMatch && notEmpty;
    });

  if (matchedRows.length > 0) {
    const { row, index } = matchedRows.at(-1); // ✅ 取最後一筆符合的
    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3;
      const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
      if (isEmpty) {
        return { type: 'repurchase', rowIndex: index + 1 };
      }
    }
    throw new Error('❌ 回購欄位已滿，無法再寫入');
  }

  // ✅ 新客 or 追蹤 ➜ 無符合者
  return { type: 'new', rowIndex: null };
}
