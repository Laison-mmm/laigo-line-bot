import fetch from 'node-fetch';

export default async function verifyCustomer(order) {
  const { ig, name, phone, inquiryDate } = order;

  if (!ig || !name || !phone || !inquiryDate) {
    throw new Error('❌ verifyCustomer：缺少欄位');
  }

  // 取得遠端試算表資料
  const res = await fetch(process.env.SHEET_API_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet 資料');

  const text = await res.text();
  const rows = text.split('\n').map(row => row.split(','));

  // 判斷三者完全相符
  const found = rows.find(r =>
    r[3] === ig && r[4] === name && r[5] === phone
  );

  // 取得今天六碼格式
  const todayCode = getTodayCode();
  const level = found ? '已回購' : (inquiryDate === todayCode ? '新客' : '追蹤');

  return { level };
}

function getTodayCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`; // ➜ 例如 '250619'
}
