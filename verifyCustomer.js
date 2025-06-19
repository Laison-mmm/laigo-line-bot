// writeToSheet.js
import fetch from 'node-fetch';

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;   // 讀取用 (CSV)
const SHEET_WRITE_URL = process.env.SHEET_API_URL;       // GAS WebApp (寫入)
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;                               // K~M、N~P …

/** 工具：台北現在時間物件 */
const taipeiNow = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));

/** 工具：去空白／全形空白／零寬後轉半形 */
const cleanAll = s =>
  String(s || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC');

/** 工具：電話 → 純 10 碼字串（保 0） */
const normPhone = s => {
  const digits = String(s).replace(/\D/g, '');
  let p = digits.startsWith('886') ? digits.slice(3) : digits;
  if (p.length === 9) p = '0' + p;          // 918… → 0918…
  return p;
};

/** 寫入主程序 */
export default async function writeToSheet(order) {
  /* ---------- 1. 讀取現有 CSV 判斷是否已存在 ---------- */
  const res = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const rows = (await res.text()).trim().split('\n').map(r => r.split(','));
  const rowIndex = rows.findIndex(r =>
    cleanAll(r[3]) === cleanAll(order.ig) &&
    cleanAll(r[4]) === cleanAll(order.name) &&
    normPhone(r[5])  === normPhone(order.phone)
  );                                           // -1 = 新客

  /* ---------- 2. 日期 & 等級判斷 ---------- */
  const now      = taipeiNow();
  const todayMD  = `${now.getMonth() + 1}/${now.getDate()}`; // 6/20
  const todayMMDD = (`0${now.getMonth()+1}`).slice(-2) + (`0${now.getDate()}`).slice(-2); // 0620
  const inquiryMMDD = order.inquiryDate.slice(2);            // '250620' → '0620'

  const level =
    rowIndex !== -1                 ? '已回購'
    : inquiryMMDD === todayMMDD     ? '新客'
    : '追蹤';

  /* ---------- 3. 準備共用 payload（文字欄位前加 ' 保格式） ---------- */
  const basePayload = {
    channel: CHANNEL,
    ig: order.ig,
    name: order.name,
    phone: `'${normPhone(order.phone)}`,        // ⬅ 保前導 0
    inquiryDate: order.inquiryDate,
    orderDate: todayMD,                        // 6/20
    quantity: `'${order.quantity}`,            // ⬅ 避免被當日期
    product: PRODUCT_NAME,
    notes: order.notes,
    level
  };

  /* ---------- 4. 新客 / 追蹤：新增一列 ---------- */
  if (rowIndex === -1) {
    const body = { mode: 'appendNew', data: basePayload };
    const rs   = await fetch(SHEET_WRITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
    console.log('📄 GAS 回傳結果:', rs.status);
    return;
  }

  /* ---------- 5. 已回購：寫入右側空欄 ---------- */
  // 找當列右側第一組 K~M / N~P… 的空白起點
  const row   = rows[rowIndex];
  let groupNo = -1;
  for (let g = 0; g < MAX_GROUPS; g++) {
    const base = 10 + g * 3;
    if (!row[base] && !row[base + 1] && !row[base + 2]) { groupNo = g; break; }
  }
  if (groupNo === -1) throw new Error('❌ 回購欄位已滿，無法再寫入');

  const body = {
    mode: 'appendRight',
    data: {
      ...basePayload,
      row: rowIndex + 1                       // 1-based 行號
    }
  };
  const rs = await fetch(SHEET_WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json());
  console.log('📄 GAS 回傳結果:', rs.status);
}
