import fetch from 'node-fetch';

export default async function verifyCustomer(order) {
  const { ig, name, phone, inquiryDate } = order;

  if (!ig || !name || !phone || !inquiryDate) {
    throw new Error('❌ verifyCustomer：缺少必要欄位');
  }

  const todayCode = getTodayCode();

  const res = await fetch(process.env.SHEET_API_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet 資料');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(row => row.split(','));

  const clean = (str) => str?.trim();

  const rowIndex = rows.findIndex(r =>
    clean(r[3]) === clean(ig) &&
    clean(r[4]) === clean(name) &&
    clean(r[5]) === clean(phone)
  );

  if (rowIndex !== -1) {
    return {
      level: '已回購',
      rowIndex
    };
  }

  const level = inquiryDate === todayCode ? '新客' : '追蹤';
  return { level };
}

function getTodayCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
