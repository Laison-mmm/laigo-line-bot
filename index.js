const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const dotenv = require('dotenv');
const { parseOrder } = require('./parser');
const { verifyCustomer } = require('./verifyCustomer');
const { writeToSheet } = require('./sheetWriter');

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();
const client = new Client(config);
const pendingOrders = new Map();

function safeReply(client, token, message) {
  return client.replyMessage(token, message).catch((err) => {
    console.warn('⚠️ replyMessage 失敗（可能 token 已過期）：', err.message);
  });
}

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId;
    const text = event.message?.text?.trim();

    if (!replyToken || !userId || !text) continue;

    try {
      // ➤ 處理報單文字
      if (text.startsWith('報單')) {
        let order;
        try {
          order = parseOrder(text);
        } catch (err) {
          await safeReply(client, replyToken, {
            type: 'text',
            text: '❌ 無法解析報單內容，請檢查格式是否正確',
          });
          continue;
        }

        // ➤ 欄位驗證
        const missingFields = [];
        if (!order.ig) missingFields.push('IG');
        if (!order.name) missingFields.push('姓名');
        if (!order.phone) missingFields.push('電話');
        if (!order.inquiryDate) missingFields.push('詢問日');
        if (!order.quantity) missingFields.push('盒數');

        if (missingFields.length > 0) {
          await safeReply(client, replyToken, {
            type: 'text',
            text: `❌ 資料不完整，缺少【${missingFields.join('、')}】`,
          });
          continue;
        }

        // ➤ 暫存 + 客戶身份驗證
        const checkResult = await verifyCustomer(order);
        const finalOrder = { ...order, ...checkResult };
        pendingOrders.set(userId, finalOrder);

        const preview = `👤 ${finalOrder.inquiryDate}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 輸入「取消」將清除報單`;
        await safeReply(client, replyToken, {
          type: 'text',
          text: preview,
        });
        continue;
      }

      // ➤ 確認送出
      if (text === '確定' && pendingOrders.has(userId)) {
        const finalOrder = pendingOrders.get(userId);
        pendingOrders.delete(userId);

        try {
          const result = await writeToSheet(finalOrder);
          await client.pushMessage(userId, {
            type: 'text',
            text: `✅ 報單成功：${finalOrder.name} 已完成`,
          });
        } catch (err) {
          console.error('❌ 表單寫入失敗:', err);
          await client.pushMessage(userId, {
            type: 'text',
            text: '❌ 系統錯誤，請稍後再試',
          });
        }
        continue;
      }

      // ➤ 取消報單
      if (text === '取消' && pendingOrders.has(userId)) {
        pendingOrders.delete(userId);
        await safeReply(client, replyToken, {
          type: 'text',
          text: '❌ 已取消報單',
        });
        continue;
      }
    } catch (err) {
      console.error('❌ 處理 webhook 事件失敗:', err);
      await safeReply(client, replyToken, {
        type: 'text',
        text: '❌ 系統錯誤，請稍後再試',
      });
    }
  }

  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 LAIGO Bot running on port', port);
});
