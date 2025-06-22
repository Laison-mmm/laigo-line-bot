// sheetWriter.js – 回購支援 PV 寫入 + 中文數字盒數 + 手機格式校驗
import fetch from 'node-fetch';

const SHEET_CSV_URL   = process.env.SHEET_API_URL_CSV;
const SHEET_WRITE_URL = process.env.SHEET_API_URL;
const PRODUCT_NAME    = '雙藻🌿';
const CHANNEL         = 'IG';
const MAX_GROUPS      = 6;

/* ───── 小工具 ───── */
const tzNow = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));

const cleanAll = s => String(s || '').replace(/\s|\u3000/g,'').replace(/[\u200B-\u200D\uFEFF]/g,'').normalize('NFKC');

const normPhone = s => {
  const d = String(s).replace(/\D/g,'');
  let p = d.startsWith('886') ? d.slice(3) : d;
  return p.length === 9 ? '0'+p : p;
};

/* 中文數字 ➜ 整數 */
const chineseMap = { 一:1, 二:2, 兩:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 };
function parseQuantity(txt){
  const digit = String(txt).match(/\d+/)?.[0];
  if (digit) return parseInt(digit,10);

  const zh = String(txt).match(/[一二兩三四五六七八九十]+/)?.[0];
  if (!zh) return 0;
  if (zh === '十') return 10;
  if (zh.length === 2 && zh[1]==='十') return chineseMap[zh[0]]*10;           // 二十
  if (zh.length === 2 && zh[0]==='十') return 10 + chineseMap[zh[1]];         // 十二
  if (zh.length === 3 && zh[1]==='十') return chineseMap[zh[0]]*10 + chineseMap[zh[2]]; // 二十三
  return chineseMap[zh] || 0;
}

/* ───── 主程式 ───── */
export async function writeToSheet(order){
  const phone10 = normPhone(order.phone);
  if (phone10.length!==10) throw new Error('手機號碼不足 10 碼');

  let rowIndex = typeof order.rowIndex==='number'&&order.rowIndex>0 ? order.rowIndex-1 : -1;
  const csv  = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`).then(r=>r.text());
  const rows = csv.trim().split('\n').map(r=>r.split(','));

  if(rowIndex===-1){
    rowIndex = rows.findIndex(r =>
      cleanAll(r[3])===cleanAll(order.ig) &&
      cleanAll(r[4])===cleanAll(order.name) &&
      normPhone(r[5])===phone10
    );
  }
  const isRepurchase = rowIndex!==-1;

  const now = tzNow();
  const todayMD = `${now.getMonth()+1}/${now.getDate()}`;
  const todayMMDD = (`0${now.getMonth()+1}`).slice(-2)+(`0${now.getDate()}`).slice(-2);
  const inquiryMMDD = order.inquiryDate.slice(2);
  const level = isRepurchase ? '已回購' : (inquiryMMDD===todayMMDD?'新客':'追蹤');

  const qty = parseQuantity(order.quantity);
  const pv = parseInt(order.pv || '0', 10);

  const base = {
    channel: CHANNEL,
    ig: order.ig,
    name: order.name,
    phone: `'${phone10}`,
    inquiryDate: order.inquiryDate,
    orderDate: `'${todayMD}`,
    quantity: `'${qty}`,
    product: PRODUCT_NAME,
    pv, // ✅ 新增 PV 欄
    notes: order.notes,
    level
  };

  if(!isRepurchase){
    await fetch(SHEET_WRITE_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'appendNew',data:base})
    });
    return;
  }

  const row = rows[rowIndex];
  let spaceIndex = -1;
  for(let g=0; g<MAX_GROUPS; g++){
    const c = 10 + g * 4; // 每組4欄：訂購日、產品、盒數、PV
    if(!row[c] && !row[c+1] && !row[c+2] && !row[c+3]){
      spaceIndex = c;
      break;
    }
  }
  if(spaceIndex === -1) throw new Error('回購欄位已滿');

  await fetch(SHEET_WRITE_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      mode: 'appendRight',
      data: {
        ...base,
        row: rowIndex + 1
      }
    })
  });
}
