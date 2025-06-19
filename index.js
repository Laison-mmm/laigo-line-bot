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

// ✅ 安全回覆封裝（避免 replyToken 過期）
async function safeReply(token, message) {
  try {
    await client.replyMessage(token, message);
  } catch (err) {
    console.warn('⚠️ reply 失敗（可能已使用或過期）');
  }
}

// ✅ 安全推送封裝
async function safePush(userId, message) {
  try {
    await client.pushMessage(userId, message);
  } catch (err) {
    console.error('❌ push 失敗：', err);
  }
}

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    try {
      const text = event.message?.text?.trim();
      const userId = event.source?.userId;
      const replyToken = event.replyToken;

      if (!text || !userId || !replyToken) continue;

      // 🟡 [1] 報單觸發
      if (text.startsWith('報單')) {
        const order = parseOrder(text);

        // 欄位驗證
        const missingFields = [];
        if (!order.ig) missingFields.push('IG');
        if (!order.name) missingFields.push('姓名');
        if (!order.phone) missingFields.push('電話');
        if (!order.inquiryDate) missingFields.push('詢問日');
        if (!order.quantity) missingFields.push('盒數');

        if (missingFields.length > 0) {
          await safeReply(replyToken, {
            type: 'text',
            text: `❌ 資料不完整，缺少【${missingFields.join('、')}】`,
          });
          continue;
        }

        // 資料驗證 + 暫存
        const checkResult = await verifyCustomer(order);
        const finalOrder = { ...order, ...checkResult };
        pendingOrders.set(userId, finalOrder);

        const preview = `👤 ${finalOrder.inquiryDate}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 輸入「取消」將清除報單`;
        await safeReply(replyToken, {
          type: 'text',
          text: preview,
        });
        continue;
      }

      // 🟢 [2] 確定送出
      if (text === '確定' && pendingOrders.has(userId)) {
        const finalOrder = pendingOrders.get(userId);
        pendingOrders.delete(userId);

        try {
          await writeToSheet(finalOrder);
          await safePush(userId, {
            type: 'text',
            text: `✅ 報單成功：${finalOrder.name} 已完成`,
          });
        } catch (err) {
          console.error('❌ 寫入表單錯誤:', err);
          await safePush(userId, {
            type: 'text',
            text: `❌ 系統錯誤，報單未完成，請稍後再試或聯絡客服`,
          });
        }
        continue;
      }

      // 🔴 [3] 取消報單
      if (text === '取消' && pendingOrders.has(userId)) {
        pendingOrders.delete(userId);
        await safeReply(replyToken, {
          type: 'text',
          text: '❌ 已取消報單',
        });
        continue;
      }

    } catch (err) {
      console.error('❌ 處理 webhook 錯誤：', err);
    }
  }

  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 LAIGO Bot running on port', port);
});
