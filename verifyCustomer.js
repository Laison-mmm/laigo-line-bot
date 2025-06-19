import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS = 6;

export async function verifyCustomer(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));
  const clean = str => String(str || '').replace(/\s/g, '').trim();

  // ✅ 精準比對：IG + 姓名 + 電話 三個都要一致
  const rowIndex = rows.findIndex(r =>
    clean(r[3]) === clean(order.ig) &&
    clean(r[4]) === clean(order.name) &&
    clean(r[5]) === clean(order.phone)
  );

  if (rowIndex !== -1) {
    // ✅ 回購：找右側空白組
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

  // ✅ 新客 or 追蹤：Node 判斷 inquiryDate 是否為今天
  return { type: 'new', rowIndex: null };
}
