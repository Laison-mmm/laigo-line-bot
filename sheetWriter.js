import fetch from 'node-fetch';

export default async function writeToSheet(order) {
  const payload = {
    level: order.level,
    channel: 'IG', // ✅ 固定欄位
    inquiryDate: order.inquiryDate,
    ig: order.ig,
    name: order.name,
    phone: order.phone,
    orderDate: order.orderDate,
    product: '雙藻🌿', // ✅ 固定欄位
    quantity: order.quantity,
    notes: order.notes,
  };

  const res = await fetch(process.env.SHEET_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });

  const text = await res.text();
  console.log('📤 已送出資料到 Sheet：', text);

  if (!res.ok || text.includes('❌')) {
    throw new Error(text);
  }

  return text;
}
