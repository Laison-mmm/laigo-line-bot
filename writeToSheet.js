// writeToSheet.js – 等級判斷 / 電話前導0 / 訂購日文字 / 手機10碼驗證
import fetch from 'node-fetch';

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;   // 讀 CSV
const SHEET_WRITE_URL = process.env.SHEET_API_URL;       // GAS WebApp
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;

/* 工具 */
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
  return p.length === 9 ? '0' + p : p;
};

/* 主程序 */
export default async function writeToSheet(order) {
  /* 0. 手機長度驗證 */
  const phone10 = normPhone(order.phone);
  if (phone10.length !== 10) {
    console.log('❌ 手機號碼不足 10 碼，拒絕報單：', phone10);
    return;
  }

  /* 1. 判斷是否回購 */
  const csv  = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`).then(r => r.text());
  const rows = csv.trim().split('\n').map(r => r.split(','));

  const rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === cleanAll(order.ig) &&
    cleanAll(r[4]) === cleanAll(order.name) &&
    normPhone(r[5]) === phone10
  );

  /* 2. 今日字串 & 等級 */
  const now        = tzNow();
  const todayMD    = `${now.getMonth() + 1}/${now.getDate()}`;            // 6/20
  const todayMMDD  = (`0${now.getMonth()+1}`).slice(-2) + (`0${now.getDate()}`).slice(-2);
  const inquiryMMDD = order.inquiryDate.slice(2);                         // 250620→0620

  const level =
    rowIndex !== -1             ? '已回購'
    : inquiryMMDD === todayMMDD ? '新客'
    : '追蹤';

  /* 3. 共用 payload（電話/盒數/訂購日加 ' 保文字） */
  const base = {
    channel     : CHANNEL,
    ig          : order.ig,
    name        : order.name,
    phone       : `'${phone10}`,          // '0918…
    inquiryDate : order.inquiryDate,
    orderDate   : `'${todayMD}`,          // '6/20
    quantity    : `'${order.quantity}`,   // '3
    product     : PRODUCT_NAME,
    notes       : order.notes,
    level
  };

  /* 4. 新客 / 追蹤 */
  if (rowIndex === -1) {
    await fetch(SHEET_WRITE_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ mode: 'appendNew', data: base })
    });
    return;
  }

  /* 5. 已回購 */
  const row = rows[rowIndex];
  let groupNo = -1;
  for (let g = 0; g < MAX_GROUPS; g++) {
    const baseCol = 10 + g * 3;
    if (!row[baseCol] && !row[baseCol+1] && !row[baseCol+2]) { groupNo = g; break; }
  }
  if (groupNo === -1) throw new Error('❌ 回購欄位已滿');

  await fetch(SHEET_WRITE_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      mode: 'appendRight',
      data: { ...base, row: rowIndex + 1 }     // 1-based
    })
  });
}
