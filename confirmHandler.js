
import writeToSheet from './sheetWriter.js';

export default async function handleConfirm(userId, pendingOrders, client, replyToken) {
  const order = pendingOrders.get(userId);
  await writeToSheet(order);
  pendingOrders.delete(userId);
  await client.replyMessage(replyToken, { type: 'text', text: '✅ 已送出報單' });
}
