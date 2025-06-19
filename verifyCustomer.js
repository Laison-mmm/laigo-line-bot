// writeToSheet.js  – 修正：等級判斷 / 電話前導 0 / 訂購日格式 (M/D)
import fetch from 'node-fetch';

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;   // 讀 CSV
const SHEET_WRITE_URL = process.env.SHEET_API_URL;       // GAS WebApp
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;

/* 共用工具 ------------------------------------------------------------ */
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
  return p.length === 9 ? '0' + p : p;             // 保證 10 碼 + 前導 0
};

/* 主程序 -------------------------------------------------------------- */
export default async function writeToSheet(order) {

  /* 1. 讀現有 CSV 判斷 rowIndex */
  const csv = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`)
              .then(r => r.text());
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === cleanAll(order.ig) &&
    cleanAll(r[4]) === cleanAll(order.name) &&
    normPhone(r[5])  === normPhone(order.phone)
  );

  /* 2. 今日字串 (M/D) 及等級判斷 ------------------------------------ */
  const now        = tzNow();
  const todayMD    = `${now.getMonth() + 1}/${now.getDate()}`;          // 6/20
  const todayMMDD  = (`0${now.getMonth()+1}`).slice(-2) + (`0${now.getDate()}`).slice(-2); // 0620
  const inquiryMMDD = order.inquiryDate.slice(2);                       // '250620' → '0620'

  const level =
    rowIndex !== -1            ? '已回購'
    : inquiryMMDD === todayMMDD? '新客'
    : '追蹤';

  /* 3. 基本 payload（電話、盒數加 ' 防格式化） ---------------------- */
  const payload = {
    channel: CHANNEL,
    ig: order.ig,
    name: order.name,
    phone: `'${normPhone(order.phone)}`,      // '0918123456
    inquiryDate: order.inquiryDate,
    orderDate: todayMD,                       // 6/20
    quantity: `'${order.quantity}`,           // '3
    product: PRODUCT_NAME,
    notes: order.notes,
    level
  };

  /* 4. 新客 / 追蹤 → appendNew -------------------------------------- */
  if (rowIndex === -1) {
    await fetch(SHEET_WRITE_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ mode: 'appendNew', data: payload })
    });
    return;
  }

  /* 5. 已回購 → 找右側空欄 ------------------------------------------ */
  const row = rows[rowIndex];
  let groupNo = -1;
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;                       // K~M / N~P …
    if (!row[base] && !row[base+1] && !row[base+2]) { groupNo = g; break; }
  }
  if (groupNo === -1) throw new Error('❌ 回購欄位已滿');

  await fetch(SHEET_WRITE_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      mode: 'appendRight',
      data: { ...payload, row: rowIndex + 1 }      // 1-based 行號
    })
  });
}
