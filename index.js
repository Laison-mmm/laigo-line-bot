// 主 webhook 入口
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import dotenv from 'dotenv';
import parseOrder from './parseOrder.js';
import verifyCustomer from './verifyCustomer.js';
import handleConfirm from './confirmHandler.js';

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();
const client = new Client(config);

// 暫存報單區
const pendingOrders = new Map();

app.post('/webhook', middleware(config), async (req, res) => {
  console.log("✅ 收到 LINE webhook 請求");
  const events = req.body.events;

  for (const event of events) {
    console.log("📥 處理事件：", event);

    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const userId = event.source.userId;
      console.log("✉️ 收到訊息：", text, "from user:", userId);

      if (text.startsWith('報單')) {
        const order = parseOrder(text);
        if (!order) {
          console.log("❌ 報單格式錯誤，parseOrder 回傳 null");
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '格式錯誤，請依照五行格式填寫報單 🙏',
          });
          continue;
        }

        const checkResult = await verifyCustomer(order);
        const finalOrder = { ...order, ...checkResult };
        pendingOrders.set(userId, finalOrder);
        console.log("📝 儲存暫存報單：", finalOrder);

        const preview = `👤 ${finalOrder.ig}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 輸入「取消」將清除報單`;
        await client.replyMessage(event.replyToken, { type: 'text', text: preview });
      }

      if (text === '確定' && pendingOrders.has(userId)) {
        console.log("✅ 確認送出報單 for user:", userId);
        await handleConfirm(userId, pendingOrders, client, event.replyToken);
      }

      if (text === '取消' && pendingOrders.has(userId)) {
        console.log("🗑️ 取消報單 for user:", userId);
        pendingOrders.delete(userId);
        await client.replyMessage(event.replyToken, { type: 'text', text: '❌ 已取消報單' });
      }
    }
  }

  res.sendStatus(200);
});

// 啟動伺服器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 LAIGO Bot running on port', port);
});
