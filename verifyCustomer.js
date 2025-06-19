import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));
  const clean = str => String(str || '').replace(/\s/g, '').trim();

  // ✅ 找出所有符合 IG + 姓名 + 電話 的行
  const matchedRows = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) =>
      clean(row[3]) === clean(order.ig) &&
      clean(row[4]) === clean(order.name) &&
      clean(row[5]) === clean(order.phone)
    );

  if (matchedRows.length > 0) {
    // ✅ 取最後一筆完全符合的資料行
    const { row, index } = matchedRows.at(-1);

    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3;
      const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
      if (isEmpty) {
        return { type: 'repurchase', rowIndex: Number(index) + 1 }; // ✅ 明確轉成整數，避免錯位
      }
    }

    throw new Error('❌ 回購欄位已滿，無法再寫入');
  }

  // ✅ 沒找到 ➜ 判定為新客 or 追蹤（後續由 writeToSheet 決定）
  return { type: 'new', rowIndex: null };
}
