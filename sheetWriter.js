// sheetWriter.js – 修：盒數寫入只留數字
import fetch from 'node-fetch';

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;

/* 小工具 */
const tzNow = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
const cleanAll = s => String(s || '').replace(/[\s\u3000]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').normalize('NFKC');
const normPhone = s => {
  const d = String(s).replace(/\D/g, '');
  let p = d.startsWith('886') ? d.slice(3) : d;
  return p.length === 9 ? '0' + p : p;
};

export async function writeToSheet(order) {
  /* 0. 手機 10 碼驗證 */
  const phone10 = normPhone(order.phone);
  if (phone10.length !== 10) {
    console.log('❌ 手機號碼不足 10 碼：', phone10);
    return;
  }

  /* 1. 行號決定（先信 order.rowIndex） */
  let rowIndex = typeof order.rowIndex === 'number' && order.rowIndex > 0 ? order.rowIndex - 1 : -1;
  const csv  = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`).then(r => r.text());
  const rows = csv.trim().split('\n').map(r => r.split(','));

  if (rowIndex === -1) {
    rowIndex = rows.findIndex(r =>
      cleanAll(r[3]) === cleanAll(order.ig) &&
      cleanAll(r[4]) === cleanAll(order.name) &&
      normPhone(r[5]) === phone10
    );
  }
  const isRepurchase = rowIndex !== -1;

  /* 2. 今日日期 & 等級 */
  const now        = tzNow();
  const todayMD    = `${now.getMonth() + 1}/${now.getDate()}`;
  const todayMMDD  = (`0${now.getMonth()+1}`).slice(-2) + (`0${now.getDate()}`).slice(-2);
  const inquiryMMDD = order.inquiryDate.slice(2);
  const level =
    isRepurchase               ? '已回購'
    : inquiryMMDD === todayMMDD? '新客'
    : '追蹤';

  /* 3. 盒數：只留第一個數字 */
  const qty = parseInt(String(order.quantity).match(/\d+/)?.[0] || '0', 10);

  /* 4. 共用 payload */
  const base = {
    channel     : CHANNEL,
    ig          : order.ig,
    name        : order.name,
    phone       : `'${phone10}`,
    inquiryDate : order.inquiryDate,
    orderDate   : `'${todayMD}`,
    quantity    : `'${qty}`,
    product     : PRODUCT_NAME,
    notes       : order.notes,
    level
  };

  /* 5. 寫入 */
  if (!isRepurchase) {
    await fetch(SHEET_WRITE_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ mode: 'appendNew', data: base })
    });
    return;
  }

  // 找右側空欄
  const row = rows[rowIndex];
  let ok = false;
  for (let g = 0; g < MAX_GROUPS; g++) {
    const baseCol = 10 + g * 3;
    if (!row[baseCol] && !row[baseCol+1] && !row[baseCol+2]) { ok = true; break; }
  }
  if (!ok) throw new Error('❌ 回購欄位已滿');

  await fetch(SHEET_WRITE_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      mode: 'appendRight',
      data: { ...base, row: rowIndex + 1 }
    })
  });
}
