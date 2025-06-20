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

// ✅ 安全 reply（避免炸）
async function safeReply(token, message) {
  try {
    await client.replyMessage(token, message);
  } catch (err) {
    console.warn('⚠️ reply 失敗:', err.message);
  }
}

// ✅ 安全 push（避免炸）
async function safePush(to, message) {
  try {
    await client.pushMessage(to, message);
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
      const replyToken = event.replyToken;
      const source = event.source;
      const userId = source.userId || '';
      const groupId = source.groupId || '';
      const senderId = groupId || userId;

      if (!text || !replyToken) continue;

      // 🟡 開始報單
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

        const checkResult = await verifyCustomer(order);
        const finalOrder = { ...order, ...checkResult, submitted: false };
        pendingOrders.set(senderId, finalOrder);

        const preview = `👤 ${finalOrder.inquiryDate}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 請輸入「取消」`;
        await safeReply(replyToken, { type: 'text', text: preview });
        continue;
      }

      // 🟢 確定送出
      if (text === '確定') {
        const finalOrder = pendingOrders.get(groupId || userId);
        if (!finalOrder || finalOrder.submitted) continue;

        try {
          finalOrder.submitted = true;
          await writeToSheet(finalOrder);

          await safePush(groupId || userId, {
            type: 'text',
            text: `✅ 報單成功：${finalOrder.name} 已完成`,
          });
        } catch (err) {
          console.error('❌ 寫入錯誤:', err.message);
          await safePush(groupId || userId, {
            type: 'text',
            text: '❌ 系統錯誤，報單未完成，請稍後再試或聯絡客服',
          });
        } finally {
          pendingOrders.delete(groupId || userId);
        }

        continue;
      }

      // 🔴 取消報單
      if (text === '取消' && pendingOrders.has(groupId || userId)) {
        pendingOrders.delete(groupId || userId);
        await safeReply(replyToken, { type: 'text', text: '❌ 已取消報單' });
        continue;
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ webhook 全域錯誤:', err);
    res.sendStatus(200);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 LAIGO Bot running on port', port);
});
const express = require('express');
const { Client } = require('@line/bot-sdk');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

// ✅ 接收來自 index.js 的 webhook 通知
app.post('/notify', async (req, res) => {
  const { result, name, groupId } = req.body;

  if (!groupId || !name) {
    console.warn('❌ 缺少 groupId 或 name');
    return res.sendStatus(400);
  }

  const msg = {
    type: 'text',
    text: result === 'success'
      ? `✅ 報單成功：${name} 已完成`
      : `❌ 報單失敗：${name}，請確認格式`,
  };

  try {
    await client.pushMessage(groupId, msg);
    console.log('📣 群組推播完成:', name);
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ 推播錯誤:', err.message);
    res.sendStatus(500);
  }
});

const port = process.env.NOTIFY_PORT || 4000;
app.listen(port, () => {
  console.log(`📡 Notify server running on port ${port}`);
});
