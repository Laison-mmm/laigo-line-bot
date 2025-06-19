// 主 webhook 入口（強化版）
const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const dotenv = require('dotenv');
const { parseOrder } = require('./parser');
const { verifyCustomer } = require('./verifyCustomer');
const { saveCache, getCache, clearCache } = require('./confirmCache');
const { writeToSheet } = require('./sheetWriter');

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

          const previewLine = `${finalOrder.level || ''} ${finalOrder.inquiryDate} ${finalOrder.previewText || ''}`.trim();
          const preview = `👤 ${previewLine}｜${finalOrder.name}
這筆資料要送出嗎？
✅ 請輸入「確定」
❌ 輸入「取消」將清除報單`;
          await client.replyMessage(event.replyToken, { type: 'text', text: preview });
        }

        if (text === '確定' && pendingOrders.has(userId)) {
          const finalOrder = pendingOrders.get(userId);
          pendingOrders.delete(userId);
          const result = await writeToSheet(finalOrder);
          await client.replyMessage(event.replyToken, { type: 'text', text: result });
        }

        if (text === '取消' && pendingOrders.has(userId)) {
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
