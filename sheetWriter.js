export async function writeToSheet(order) {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error('❌ 無法讀取 Google Sheet');

  const csv = await res.text();
  const rows = csv.trim().split('\n').map(r => r.split(','));
  const today = new Date().toISOString().slice(0, 10);

  if (!order.ig || !order.name || !order.phone || !order.inquiryDate || !order.quantity) {
    throw new Error('❌ 資料不足（共用檢查）');
  }

  const payload = {
    mode: '',
    data: {
      channel: CHANNEL,
      ig: order.ig,
      name: order.name,
      phone: order.phone,
      inquiryDate: order.inquiryDate,
      orderDate: today,
      quantity: parseQuantity(order.quantity),
      product: PRODUCT_NAME,
      notes: order.notes || '',
    }
  };

  if (order.type === 'repurchase') {
    payload.mode = 'appendRight';
    payload.data.row = order.rowIndex;

    console.log('🔁 回購資料送出:', payload);
    const resultText = await send(payload);
    return resultText;
  }

  const isToday = isTodayInquiry(order.inquiryDate);
  payload.mode = 'appendNew';
  payload.data.level = isToday ? '新客' : '追蹤';

  console.log('🆕 新客資料送出:', payload);
  const resultText = await send(payload);
  return resultText;
}
