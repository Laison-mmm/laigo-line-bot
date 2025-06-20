// verifyCustomer.js – 嚴格三碼 + 防跳位（單一 default 匯出）
import fetch from 'node-fetch';

const SHEET_CSV_URL = process.env.SHEET_API_URL_CSV;
const MAX_GROUPS    = 6;

/* 工具 */
const cleanAll = s =>
  String(s || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC');

const normPhone = s => {
  const d = String(s).replace(/\D/g, '');
  let p = d.startsWith('886') ? d.slice(3) : d;
  return p.length === 9 ? '0' + p : p;      // 918… → 0918…
};

/* 主函式 */
function verifyCustomer(order) {
  return (async () => {
    /* 1. 抓 CSV（破快取） */
    const res  = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
    if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');
    const rows = (await res.text()).trim().split('\n').map(r => r.split(','));

    /* 2. 三碼 */
    const ig    = cleanAll(order.ig);
    const name  = cleanAll(order.name);
    const phone = normPhone(order.phone);

    /* 3. 比對 idx */
    const idx = rows.findIndex(r =>
      cleanAll(r[3]) === ig &&
      cleanAll(r[4]) === name &&
      normPhone(r[5]) === phone
    );

    /* 4. 找不到 → 新客 / 追蹤 */
    if (idx === -1) {
      console.log('🆕 新客 / 追蹤：三碼對不到', { ig, name, phone });
      return { type: 'new', rowIndex: null };
    }

    /* 5. 真實行號（排空白列） */
    const realRow = rows
      .slice(0, idx + 1)
      .filter(r => cleanAll(r[3]) || cleanAll(r[4]) || normPhone(r[5]))
      .length;                         // 1-based

    /* 6. 找右側空欄 */
    const row = rows[idx];
    for (let g = 0; g < MAX_GROUPS; g++) {
      const base = 10 + g * 3;
      if (!row[base] && !row[base + 1] && !row[base + 2]) {
        return { type: 'repurchase', rowIndex: realRow };
      }
    }
    throw new Error('❌ 回購欄位已滿，無法再寫入');
  })();
}

/* 單一匯出：default + 具名，同時滿足兩種 import */
export { verifyCustomer as default, verifyCustomer };
