export default async function verifyCustomer(order) {
  const { ig, name, phone, inquiryDate } = order;

  if (!ig || !name || !phone || !inquiryDate) {
    throw new Error('❌ verifyCustomer：缺少欄位');
  }

  const todayCode = getTodayCode();
  const level = inquiryDate === todayCode ? '新客' : '追蹤';

  return { level };
}

function getTodayCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`; // ➜ 例如 '250619'
}
