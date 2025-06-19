import writeToSheet from './sheetWriter.js';

export default async function handleConfirm(userId, pendingOrders, client, replyToken) {
  const order = pendingOrders.get(userId);

  try {
    const result = await writeToSheet(order);
    pendingOrders.delete(userId);
    await client.replyMessage(replyToken, { type: 'text', text: '✅ 已送出報單' });
  } catch (err) {
    console.error('❌ 寫入失敗:', err);
    await client.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 送出失敗：' + err.message,
    });
  }
}
