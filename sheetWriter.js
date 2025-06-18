import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

export default async function writeToSheet(order) {
  const payload = {
    level: order.level,
    channel: order.channel,
    inquiryDate: order.inquiryDate,
    ig: order.ig,
    name: order.name,
    phone: order.phone,
    orderDate: order.orderDate,
    product: order.product,
    quantity: order.quantity,
    notes: order.notes,
  };

  const url = process.env.SHEET_API_URL;
  if (!url) {
    console.error('❌ SHEET_API_URL 未設定（.env 或 Render 環境變數）');
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.text();
    console.log('📤 已送出資料到 Sheet：', result);
  } catch (error) {
    console.error('❌ 寫入 Google Sheet 時發生錯誤：', error.message);
  }
}
