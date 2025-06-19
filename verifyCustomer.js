import fetch from 'node-fetch';

export default async function verifyCustomer(order) {
  const { ig, name, phone, inquiryDate } = order;

  if (!ig || !name || !phone || !inquiryDate) {
    throw new Error('❌ verifyCustomer：缺少必要欄位');
  }

  const todayCode = getTodayCode();

  // 呼叫 Google Sheet Web API（回傳為 JSON 陣列）
  const res = await fetch(process.env.SHEET_API_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet 資料');

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('❌ 資料格式錯誤，應為陣列');

  // 資料為陣列：每一列 = 一個 row（第一列為標題）
  const rows = data.slice(1); // 去掉標題列

  const clean = (str) => String(str || '').trim();

  const rowIndex = rows.findIndex(r =>
    clean(r[3]) === clean(ig) &&
    clean(r[4]) === clean(name) &&
    clean(r[5]) === clean(phone)
  );

  if (rowIndex !== -1) {
    console.log('✅ 判定為回購：', { ig, name, phone, rowIndex: rowIndex + 1 });
    return { level: '已回購', rowIndex: rowIndex + 1 }; // rowIndex +1 是因為表格實際是從 1 開始
  }

  const level = inquiryDate === todayCode ? '新客' : '追蹤';
  console.log(`🆕 判定為 ${level}：`, { ig, name, phone });
  return { level };
}

function getTodayCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
