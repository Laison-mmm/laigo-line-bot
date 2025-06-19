import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const START_COL = 11; // K 欄 = 第 11 欄（index = 11）
const MAX_GROUPS = 6; // 最多支援 6 次回購（3欄 × 6組）

export async function writeToSheet(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));
  const clean = str => String(str || '').replace(/\s/g, '');

  const {
    type, level, channel, inquiryDate, ig, name, phone,
    orderDate, product, quantity, notes
  } = order;

  if (!orderDate || !product || !quantity) {
    throw new Error('❌ 資料不足（共用檢查）');
  }

  // ✅ 回購 ➜ 找出現過的 rowIndex
  if (type === 'repurchase') {
    const rowIndex = rows.findIndex(r =>
      clean(r[3]) === clean(ig) ||
      clean(r[4]) === clean(name) ||
      clean(r[5]) === clean(phone)
    );

    if (rowIndex === -1) throw new Error('❌ 找不到回購客戶列');

    const row = rows[rowIndex];
    let writeCol = -1;

    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = START_COL + g * 3;
      if (!row[base] && !row[base + 1] && !row[base + 2]) {
        writeCol = base;
        break;
      }
    }

    if (writeCol === -1) throw new Error('❌ 無法寫入，已無可用回購欄');

    const body = {
      type: 'repurchase',
      rowIndex: rowIndex + 1,
      startCol: writeCol + 1,
      orderDate, product, quantity
    };

    const writeRes = await fetch(SHEET_WRITE_URL, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await writeRes.text();
    if (!result.includes('✅')) throw new Error(result);
    return result;
  }

  // ✅ 新客 / 追蹤 ➜ appendRow()
  if (type === 'new') {
    if (!ig || !name || !phone || !inquiryDate) {
      throw new Error('❌ 資料不足（新單）');
    }

    const body = {
      type: 'new',
      level,
      channel: channel || 'IG',
      inquiryDate,
      ig,
      name,
      phone,
      orderDate,
      product,
      quantity,
      notes: notes || '',
    };

    const writeRes = await fetch(SHEET_WRITE_URL, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await writeRes.text();
    if (!result.includes('✅')) throw new Error(result);
    return result;
  }

  throw new Error('❌ 未知的寫入類型');
}
