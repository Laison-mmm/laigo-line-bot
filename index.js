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

// ✅ 安全 reply（token 過期不會炸）
async function safeReply(token, message) {
  try {
    await client.replyMessage(token, message);
  } catch (err) {
    console.warn('⚠️ reply 失敗（可能已用過）:', err.message);
  }
}

// ✅ 安全 push（封裝失敗防爆）
async function safePush(userId, message) {
  try {
    await client.pushMessage(userId, message);
  } catch (err) {
    console.warn('⚠️ pushMessage 失敗:', err.message);
  }
}

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  try {
    for (const event of events) {
      const text = event.message?.text?.trim();
      const userId = event.source?.userId;
      const replyToken = event.replyToken;

      if (!text || !userId || !replyToken) continue;

      // 🟡 處理報單
      if (text.startsWith('報單')) {
        let order;
        try {
          order = parseOrder(text);
        } catch (err) {
          await safeReply(replyToken, { type: 'text', text: '❌ 無法解析報單內容，請檢查格式' });
          continue;
        }

        // 欄位驗證
        const missing = [];
        if (!order.ig) missing.push('IG');
        if (!order.name) missing.push('姓名');
        if (!order.phone) missing.push('電話');
        if (!order.inquiryDate) missing.push('詢問日');
        if (!order.quantity) missing.push('盒數');

        if (missing.length > 0) {
          await safeReply(replyToken, { type: 'text', text: `❌ 缺少欄位：${missing.join('、')}` });
          continue;
        }

        // ✨ 驗證身份並暫存
        const checkResult = await verifyCustomer(order);
        const finalOrder = { ...order, ...checkResult };
        pendingOrders.set(userId, finalOrder);

        const preview = `👤 ${finalOrder.inquiryDate}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 請輸入「取消」`;
        await safeReply(replyToken, { type: 'text', text: preview });
        continue;
      }

      // 🟢 確認送出
      if (text === '確定' && pendingOrders.has(userId)) {
        const finalOrder = pendingOrders.get(userId);
        pendingOrders.delete(userId);

        try {
          const result = await writeToSheet(finalOrder);
          console.log('📤 寫入成功：', result);

          await safePush(userId, {
            type: 'text',
            text: `✅ 報單成功：${finalOrder.name} 已完成`,
          });
        } catch (err) {
          console.error('❌ 寫入錯誤：', err.message);

          if (!err.logged) {
            err.logged = true; // 防止多次推播
            await safePush(userId, {
              type: 'text',
              text: '❌ 系統錯誤，報單未完成，請稍後再試或聯絡客服',
            });
          }
        }
        continue;
      }

      // 🔴 取消報單
      if (text === '取消' && pendingOrders.has(userId)) {
        pendingOrders.delete(userId);
        await safeReply(replyToken, {
          type: 'text',
          text: '❌ 已取消報單',
        });
        continue;
      }
    }

    res.sendStatus(200); // ✅ 保證 webhook 回 200，避免重送
  } catch (err) {
    console.error('❌ webhook 全域錯誤:', err);
    res.sendStatus(200); // ❗照樣回 200，讓 LINE 不重送
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 LAIGO Bot running on port', port);
});
