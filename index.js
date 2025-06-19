// 主 webhook 入口（強化版）
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
const pendingOrders = new Map();

app.post('/webhook', middleware(config), async (req, res) => {
  console.log('✅ 收到 LINE webhook 請求');
  const events = req.body.events;

  for (const event of events) {
    try {
      console.log('📥 處理事件：', event);

      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const userId = event.source.userId;
        console.log('✉️ 收到訊息：', text, 'from user:', userId);

        // 處理報單
        if (text.startsWith('報單')) {
          const order = parseOrder(text);
          if (!order || !order.ig || !order.name || !order.phone || !order.inquiryDate) {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '❌ 報單資料不完整（IG、姓名、電話、詢問日）',
            });
            continue;
          }

          const checkResult = await verifyCustomer(order);
          const finalOrder = { ...order, ...checkResult };
          pendingOrders.set(userId, finalOrder);
          console.log('📝 儲存暫存報單：', finalOrder);

          const previewLine = `${finalOrder.level} ${finalOrder.inquiryDate} ${finalOrder.previewText || ''}`.trim();
          const preview = `👤 ${previewLine}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 輸入「取消」將清除報單`;
          await client.replyMessage(event.replyToken, { type: 'text', text: preview });
        }

        // 處理確定送出
        if (text === '確定' && pendingOrders.has(userId)) {
          console.log('✅ 確認送出報單 for user:', userId);
          await handleConfirm(userId, pendingOrders, client, event.replyToken);
        }

        // 處理取消
        if (text === '取消' && pendingOrders.has(userId)) {
          console.log('🗑️ 取消報單 for user:', userId);
          pendingOrders.delete(userId);
          await client.replyMessage(event.replyToken, { type: 'text', text: '❌ 已取消報單' });
        }
      }
    } catch (err) {
      console.error('❌ 處理事件失敗：', err);
      try {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ 系統錯誤，請稍後再試',
        });
      } catch (replyErr) {
        console.error('❌ 回覆用戶時出錯：', replyErr);
      }
    }
  }

  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 LAIGO Bot running on port', port);
});
