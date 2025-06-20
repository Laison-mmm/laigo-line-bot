// ✅ index.js – 原始結構保留 + 加入群組通知（不影響回購定位）

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

async function safeReply(token, message) {
  try {
    await client.replyMessage(token, message);
  } catch (err) {
    console.warn('⚠️ reply 失敗:', err.message);
  }
}

async function safePush(targetId, message) {
  try {
    await client.pushMessage(targetId, message);
  } catch (err) {
    console.warn('⚠️ push 失敗:', err.message);
  }
}

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  try {
    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text = event.message.text.trim();
      const userId = event.source?.userId;
      const replyToken = event.replyToken;
      if (!text || !userId || !replyToken) continue;

      // 🟡 報單觸發
      if (text.startsWith('報單')) {
        let order;
        try {
          order = parseOrder(text);
        } catch (err) {
          await safeReply(replyToken, { type: 'text', text: '❌ 無法解析報單內容，請檢查格式' });
          continue;
        }

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

        // ✅ 這邊只保留必要欄位
        const checkResult = await verifyCustomer(order);
        order.rowIndex = checkResult.rowIndex;
        const finalOrder = { ...order, submitted: false };

        pendingOrders.set(userId, finalOrder);
        const preview = `👤 ${finalOrder.inquiryDate}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 請輸入「取消」`;
        await safeReply(replyToken, { type: 'text', text: preview });
        continue;
      }

      // 🟢 確認送出
      if (text === '確定') {
        const finalOrder = pendingOrders.get(userId);
        if (!finalOrder || finalOrder.submitted) continue;

        try {
          finalOrder.submitted = true;
          await writeToSheet(finalOrder);

          const msg = {
            type: 'text',
            text: `✅ 報單成功：${finalOrder.name} 已完成`,
          };
          await safePush(userId, msg);

          if (event.source.type === 'group') {
            await safePush(event.source.groupId, msg);
          }

        } catch (err) {
          console.error('❌ 寫入錯誤:', err.message);

          const msg = {
            type: 'text',
            text: `❌ 報單失敗：${finalOrder.name} 請稍後再試或聯絡客服`,
          };
          await safePush(userId, msg);

          if (event.source.type === 'group') {
            await safePush(event.source.groupId, msg);
          }
        } finally {
          pendingOrders.delete(userId);
        }
        continue;
      }

      // 🔴 取消報單
      if (text === '取消' && pendingOrders.has(userId)) {
        pendingOrders.delete(userId);
        await safeReply(replyToken, { type: 'text', text: '❌ 已取消報單' });
        continue;
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ webhook 錯誤:', err);
    res.sendStatus(200);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 LAIGO Bot running on port', port);
});
