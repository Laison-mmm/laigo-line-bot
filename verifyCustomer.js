
export default async function verifyCustomer(order) {
  const sheet = await fetch('https://script.google.com/macros/s/AKfycbx2pvAMpiBaKQGdymsPU4BCSRp7HRb_WXyeJprm-wKG4z0NIYesvf2wO2yKTdni6qV4bA/exec');
  const content = await sheet.text();
  const isExisting = content.includes(order.phone) || content.includes(order.ig);
  const today = new Date().toLocaleDateString('zh-TW');
  const inquiryDate = order.notes.match(/\d{1,2}\/\d{1,2}/)?.[0] || today;
  const level = isExisting ? '已回購' : (inquiryDate === today ? '新客' : '追蹤');
  return { level, channel: 'IG', inquiryDate };
}
