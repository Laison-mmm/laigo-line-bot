import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(',').map(c => c.trim()));
  const clean = str => String(str || '').replace(/\s/g, '');

  const orderName = clean(order.name);
  const orderPhone = clean(order.phone);

  // ✅ 僅當「姓名 & 電話」完全一致，才算回購
  const matchedRows = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) => {
      const rowName = clean(row[4]);
      const rowPhone = clean(row[5]);
      return rowName === orderName && rowPhone === orderPhone;
    });

  if (matchedRows.length > 0) {
    const { row, index } = matchedRows.at(-1); // 取最末筆
    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3;
      const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
      if (isEmpty) {
        return { type: 'repurchase', rowIndex: index + 1 };
      }
    }
    throw new Error('❌ 回購欄位已滿，無法再寫入');
  }

  // ✅ 視為新客
  return { type: 'new', rowIndex: null };
}
