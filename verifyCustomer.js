import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const json = await res.text();
  const rows = JSON.parse(json);

  const clean = str => String(str || '').replace(/\s/g, '').trim();
  const normalizePhone = phone => clean(phone).replace(/^(\+?886|886)/, '0'); // +886917 ➜ 0917

  const orderName = clean(order.name);
  const orderPhone = normalizePhone(order.phone);

  const matchedRows = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) =>
      clean(row[4]) === orderName &&
      normalizePhone(row[5]) === orderPhone
    );

  if (matchedRows.length > 0) {
    const { row, index } = matchedRows.at(-1); // ➜ 最後一筆相符的為主
    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3;
      const isEmpty = !row[base] && !row[base + 1] && !row[base + 2];
      if (isEmpty) {
        return { type: 'repurchase', rowIndex: index + 1 };
      }
    }
    throw new Error('❌ 回購欄位已滿，無法再寫入');
  }

  return { type: 'new', rowIndex: null };
}
