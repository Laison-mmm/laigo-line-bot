// sheetWriter.js – 修：行號正確 + 盒數留數字 + 手機不足 10 碼拋錯
import fetch from 'node-fetch';

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;

/* ───── 小工具 ───── */
const tzNow = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));

const cleanAll = s =>
  String(s || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC');

const normPhone = s => {
  const d = String(s).replace(/\D/g, '');
  let p = d.startsWith('886') ? d.slice(3) : d;
  return p.length === 9 ? '0' + p : p;            // 918… → 0918…
};

/* ───── 主程式 ───── */
export async function writeToSheet(order) {
  /* 0. 手機 10 碼驗證 ─── */
  const phone10 = normPhone(order.phone);
  if (phone10.length !== 10) {
    // 👉 改為丟例外，讓 index.js catch 後回報「報單未完成」
    throw new Error('手機號碼不足 10 碼');
  }

  /* 1. 行號決定 ─── 先信 order.rowIndex */
  let rowIndex = typeof order.rowIndex === 'number' && order.rowIndex > 0
    ? order.rowIndex - 1   // 轉 0-based
    : -1;

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

  /* 3. 抽出純數字盒數 */
  const qty = parseInt(String(order.quantity).match(/\d+/)?.[0] || '0', 10);

  /* 4. 共用 payload（電話 / 盒數 / 訂購日加 ' 保文字） */
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

  /* 5. 新客 / 追蹤 ─── appendNew */
  if (!isRepurchase) {
    await fetch(SHEET_WRITE_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ mode: 'appendNew', data: base })
    });
    return;
  }

  /* 6. 已回購 ─── 找右側空欄 */
  const row = rows[rowIndex];
  let ok = false;
  for (let g = 0; g < MAX_GROUPS; g++) {
    const baseCol = 10 + g * 3;          // K=10, N=13…
    if (!row[baseCol] && !row[baseCol+1] && !row[baseCol+2]) { ok = true; break; }
  }
  if (!ok) throw new Error('回購欄位已滿');

  await fetch(SHEET_WRITE_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      mode: 'appendRight',
      data: { ...base, row: rowIndex + 1 }    // 1-based 行號
    })
  });
}
