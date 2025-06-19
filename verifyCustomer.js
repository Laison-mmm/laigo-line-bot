// writeToSheet.js  – 修正：等級判斷 / 電話前導0 / 盒數日期化 / 訂購日 M/D

import fetch from 'node-fetch';

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;   // 讀 (CSV)
const SHEET_WRITE_URL = process.env.SHEET_API_URL;       // GAS WebApp (寫)
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;                               // K~M、N~P…

/* ---------- 共用工具 ---------- */
const tzNow = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));

const cleanAll = s =>
  String(s || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC');

const normPhone = s => {
  const digits = String(s).replace(/\D/g, '');
  let p = digits.startsWith('886') ? digits.slice(3) : digits;
  if (p.length === 9) p = '0' + p;
  return p;
};

/* ---------- 主程序 ---------- */
export default async function writeToSheet(order) {

  /* 1. 讀 CSV 決定 rowIndex（-1 = 新客） */
  const csvRes = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!csvRes.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const rows = (await csvRes.text()).trim().split('\n').map(r => r.split(','));
  const rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === cleanAll(order.ig) &&
    cleanAll(r[4]) === cleanAll(order.name) &&
    normPhone(r[5])  === normPhone(order.phone)
  );

  /* 2. 產今日日期字串 → 6/20 */
  const now        = tzNow();
  const todayMD    = `${now.getMonth() + 1}/${now.getDate()}`;           // 6/20
  const todayMMDD  = (`0${now.getMonth()+1}`).slice(-2) + (`0${now.getDate()}`).slice(-2); // 0620
  const inquiryMMDD = order.inquiryDate.slice(2);                        // '250620' -> '0620'

  /* 3. 等級判斷 */
  const level =
    rowIndex !== -1             ? '已回購'
    : inquiryMMDD === todayMMDD ? '新客'
    : '追蹤';

  /* 4. 準備通用 payload —— 電話 & 盒數 前加 ' 避免格式化 */
  const base = {
    channel: CHANNEL,
    ig: order.ig,
    name: order.name,
    phone: `'${normPhone(order.phone)}`,     // 保 0
    inquiryDate: order.inquiryDate,
    orderDate: todayMD,                      // M/D
    quantity: `'${order.quantity}`,          // 保純文字
    product: PRODUCT_NAME,
    notes: order.notes,
    level
  };

  /* 5. 新客 / 追蹤 —— appendNew */
  if (rowIndex === -1) {
    const rs = await fetch(SHEET_WRITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'appendNew', data: base })
    }).then(r => r.json());
    console.log('📄 GAS 回傳結果:', rs.status);
    return;
  }

  /* 6. 已回購 —— 找右側第一組空欄 */
  const row = rows[rowIndex];
  let groupNo = -1;
  for (let g = 0; g < MAX_GROUPS; g++) {
    const baseCol = 10 + g * 3;
    if (!row[baseCol] && !row[baseCol + 1] && !row[baseCol + 2]) { groupNo = g; break; }
  }
  if (groupNo === -1) throw new Error('❌ 回購欄位已滿');

  const rs = await fetch(SHEET_WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'appendRight',
      data: { ...base, row: rowIndex + 1 }   // 1-based
    })
  }).then(r => r.json());
  console.log('📄 GAS 回傳結果:', rs.status);
}
