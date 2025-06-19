import fetch from 'node-fetch';

export default async function verifyCustomer(order) {
  const { ig, name, phone, inquiryDate } = order;

  if (!ig || !name || !phone || !inquiryDate) {
    throw new Error('❌ verifyCustomer：缺少必要欄位');
  }

  // 取得六碼日期字串
  const todayCode = getTodayCode();

  // 讀取 Google Sheet CSV
  const res = await fetch(process.env.SHEET_API_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet 資料');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(row => row.split(','));

  // 三鍵比對
  const rowIndex = rows.findIndex(r =>
    r[3] === ig && r[4] === name && r[5] === phone
  );

  if (rowIndex !== -1) {
    return {
      level: '已回購',
      rowIndex
    };
  }

  // 非回購 ➜ 判斷是否為今天詢問
  const level = inquiryDate === todayCode ? '新客' : '追蹤';

  return {
    level
  };
}

function getTodayCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`; // 例如 250619
}
