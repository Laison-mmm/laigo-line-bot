import fetch from 'node-fetch';

const SHEET_URL = process.env.SHEET_API_URL;
const PRODUCT_NAME = '雙藻🌿';
const CHANNEL = 'IG';

export async function writeToSheet(order) {
  try {
    const today = new Date();
    const date = `${today.getMonth() + 1}/${today.getDate()}`;

    const payload = {
      type: 'submit',
      data: {
        level: order.level,
        ig: order.ig,
        name: order.name,
        phone: order.phone,
        inquiryDate: order.inquiryDate,
        orderDate: date,
        product: PRODUCT_NAME,
        quantity: order.quantity,
        notes: order.notes || '',
        channel: CHANNEL,
      },
    };

    const res = await fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.message || '寫入失敗（無成功訊號）');
    }

    return { success: true };
  } catch (err) {
    throw new Error(`❌ 寫入失敗（sheetWriter）：${err.message}`);
  }
}
