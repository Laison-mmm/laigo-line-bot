import fetch from 'node-fetch';

export default async function verifyCustomer(order) {
  const res = await fetch('https://script.google.com/macros/s/AKfycbx2pvAMpiBaKQGdymsPU4BCSRp7HRb_WXyeJprm-wKG4z0NIYesvf2wO2yKTdni6qV4bA/exec');
  const text = await res.text();
  const isExist = text.includes(order.phone) && text.includes(order.ig);
  const today = new Date().toLocaleDateString('zh-TW');
  const todayCode = new Date().toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6); // yyMMdd

  const level = isExist
    ? '已回購'
    : (order.inquiryDate === todayCode ? '新客' : '追蹤');

  return {
    level,
    channel: 'IG',
    inquiryDate: order.inquiryDate || todayCode
  };
}
