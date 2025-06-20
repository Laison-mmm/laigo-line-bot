// sheetWriter.js – 修正回購行號錯位（完整檔案）
import fetch from 'node-fetch';
import { cleanAll, normPhone, tzNow } from './utils.js';   // <- 你的共用工具

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;    // 讀 CSV
const SHEET_WRITE_URL = process.env.SHEET_API_URL;        // GAS WebApp
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;                                // K~M, N~P…

export async function writeToSheet(order) {
  /* ---------- 0. 手機 10 碼驗證 ---------- */
  const phone10 = normPhone(order.phone);
  if (phone10.length !== 10) {
    console.log('❌ 手機號碼不足 10 碼，拒絕報單：', phone10);
    return;
  }

  /* ---------- 1. 行號決定策略 ---------- */
  // 1-a. verifyCustomer 已提供 → 直接採用（1-based → 0-based）
  let rowIndex =
    typeof order.rowIndex === 'number' && order.rowIndex > 0
      ? order.rowIndex - 1
      : -1;

  // 1-b. 若尚未有，嚴格三碼比對再找
  let rows;   // 後面回購寫入仍要用到
  if (rowIndex === -1) {
    const csv = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`).then(r => r.text());
    rows = csv.trim().split('\n').map(r => r.split(','));

    rowIndex = rows.findIndex(r =>
      cleanAll(r[3]) === cleanAll(order.ig) &&
      cleanAll(r[4]) === cleanAll(order.name) &&
      normPhone(r[5]) === phone10
    );
  } else {
    // 如果 rowIndex 已知，還是要把 CSV 讀進來供後續右側空欄判定
    const csv = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`).then(r => r.text());
    rows = csv.trim().split('\n').map(r => r.split(','));
  }

  const isRepurchase = rowIndex !== -1;

  /* ---------- 2. 今日日期 & 等級 ---------- */
  const now        = tzNow();                                               // utils.js 提供台北時區
  const todayMD    = `${now.getMonth() + 1}/${now.getDate()}`;              // 例 6/20
  const todayMMDD  = (`0${now.getMonth()+1}`).slice(-2) + (`0${now.getDate()}`).slice(-2);
  const inquiryMMDD = order.inquiryDate.slice(2);                           // '250620' → '0620'

  const level =
    isRepurchase               ? '已回購'
    : inquiryMMDD === todayMMDD? '新客'
    : '追蹤';

  /* ---------- 3. 共用 payload（電話/盒數/訂購日加 ' 防格式化） ---------- */
  const basePayload = {
    channel     : CHANNEL,
    ig          : order.ig,
    name        : order.name,
    phone       : `'${phone10}`,              // '0918……（保前導 0）
    inquiryDate : order.inquiryDate,
    orderDate   : `'${todayMD}`,              // '6/20
    quantity    : `'${order.quantity}`,       // '3
    product     : PRODUCT_NAME,
    notes       : order.notes,
    level
  };

  /* ---------- 4. 新客 / 追蹤：appendNew ---------- */
  if (!isRepurchase) {
    await fetch(SHEET_WRITE_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ mode: 'appendNew', data: basePayload })
    });
    return;
  }

  /* ---------- 5. 已回購：尋右側第一組空欄 ---------- */
  const row = rows[rowIndex];
  let groupNo = -1;
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;                 // K=10, N=13, …
    if (!row[base] && !row[base + 1] && !row[base + 2]) {
      groupNo = g;
      break;
    }
  }
  if (groupNo === -1) throw new Error('❌ 回購欄位已滿，無法再寫入');

  await fetch(SHEET_WRITE_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      mode: 'appendRight',
      data: { ...basePayload, row: rowIndex + 1 }   // 1-based 行號給 GAS
    })
  });
}
