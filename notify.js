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
