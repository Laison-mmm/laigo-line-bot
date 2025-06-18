// 主 webhook 入口
import express from 'express';
import bodyParser from 'body-parser';
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
app.use(bodyParser.json());
app.use(middleware(config));

const pendingOrders = new Map();

app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const userId = event.source.userId;

      if (text.startsWith('報單')) {
        const order = parseOrder(text);
        if (!order) return;

        const checkResult = await verifyCustomer(order);
        const finalOrder = { ...order, ...checkResult };
        pendingOrders.set(userId, finalOrder);

        const preview = `👤 ${finalOrder.ig}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 輸入「取消」將清除報單`;
        await client.replyMessage(event.replyToken, { type: 'text', text: preview });
      }

      if (text === '確定' && pendingOrders.has(userId)) {
        await handleConfirm(userId, pendingOrders, client, event.replyToken);
      }

      if (text === '取消' && pendingOrders.has(userId)) {
        pendingOrders.delete(userId);
        await client.replyMessage(event.replyToken, { type: 'text', text: '❌ 已取消報單' });
      }
    }
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('LAIGO Bot running on port', port);
});
