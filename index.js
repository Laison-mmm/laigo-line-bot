const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const dotenv = require('dotenv');
const { parseOrder } = require('./parser');
const { verifyCustomer } = require('./verifyCustomer');
const { writeToSheet } = require('./sheetWriter');

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret     : process.env.CHANNEL_SECRET,
};

const app    = express();
const client = new Client(config);
const pendingOrders = new Map();          // key = sourceId、value = order

/* ─────────────── wrapper ─────────────── */
async function safeReply(token, message) {
  try { await client.replyMessage(token, message); }
  catch (err) { console.warn('⚠️ reply 失敗:', err.message);}
}

async function safePush(to, message) {
  const doPush = async () => client.pushMessage(to, message);
  try { await doPush(); }
  catch (err) {
    if (err.response?.status === 429) {
      const wait = (Number(err.response.headers['retry-after']) || 2) * 1000;
      console.warn(`🔄 429 限流，${wait / 1000}s 後重送`);
      setTimeout(doPush, wait);
    } else {
      console.error('❌ pushMessage 失敗:', err.message);
    }
  }
}

/* ─────────────── webhook ─────────────── */
app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    const text       = event.message?.text?.trim();
    const replyToken = event.replyToken;
    const type       = event.type;

    /* 取正確的 sourceId (user / group / room) */
    const sourceId =
      event.source.type === 'group' ? event.source.groupId :
      event.source.type === 'room'  ? event.source.roomId  :
      event.source.userId;

    if (!sourceId) continue;

    /* ────── Message: Text ────── */
    if (type === 'message' && event.message.type === 'text') {
      /* 報單 */
      if (text.startsWith('報單')) {
        let order;
        try { order = parseOrder(text); }
        catch { await safeReply(replyToken, { type:'text', text:'❌ 無法解析報單內容，請檢查格式'}); continue; }

        const missing = ['ig','name','phone','inquiryDate','quantity']
          .filter(k => !order[k]).map(k =>
            ({ig:'IG',name:'姓名',phone:'電話',inquiryDate:'詢問日',quantity:'盒數'})[k]);
        if (missing.length) {
          await safeReply(replyToken, {type:'text', text:`❌ 缺少欄位：${missing.join('、')}`});
          continue;
        }

        const checkResult = await verifyCustomer(order);
        pendingOrders.set(sourceId, {...order, ...checkResult, submitted:false});

        await safeReply(replyToken, {
          type:'flex',
          altText:'報單預覽',
          contents:{
            type:'bubble',
            body:{type:'box',layout:'vertical',contents:[
              {type:'text',text:'報單預覽',weight:'bold',size:'xl',color:'#1DB446'},
              {type:'separator',margin:'lg'},
              {type:'box',layout:'vertical',margin:'lg',contents:[
                {type:'text',text:`${order.inquiryDate}｜${order.name}`,wrap:true},
                {type:'text',text:'這筆資料要送出嗎？',margin:'md'}
              ]}
            ]},
            footer:{type:'box',layout:'vertical',spacing:'sm',contents:[
              {type:'button',style:'primary',
               action:{type:'postback',label:'確定',data:'action=confirm_order',displayText:'確定報單'}},
              {type:'button',style:'secondary',
               action:{type:'postback',label:'取消',data:'action=cancel_order',displayText:'取消報單'}}
            ]}
          }
        });
        continue;
      }

      /* 備援文字「確定」—可選保留 */
      if (text === '確定') handleConfirm(sourceId, replyToken);
      if (text === '取消') handleCancel(sourceId, replyToken);
    }

    /* ────── Postback ────── */
    if (type === 'postback') {
      const data = event.postback.data;
      if (data === 'action=confirm_order') handleConfirm(sourceId, replyToken);
      if (data === 'action=cancel_order')  handleCancel(sourceId, replyToken);
    }
  }
  res.sendStatus(200);           // 永遠 200，避免重送
});

/* ─────────────── handlers ─────────────── */
async function handleConfirm(sourceId, replyToken){
  const order = pendingOrders.get(sourceId);
  if (!order || order.submitted) return;

  try {
    order.submitted = true;
    await writeToSheet(order);
    await safePush(sourceId, {type:'text', text:`✅ 報單成功：${order.name} 已完成`});
  } catch (err) {
    console.error('❌ 寫入錯誤:', err.message);
    await safePush(sourceId, {type:'text', text:'❌ 系統錯誤，報單未完成，請稍後再試'});
  } finally {
    pendingOrders.delete(sourceId);
  }

  /* 若還在 2 分鐘內，replyToken 可用，回覆 Done */
  if (replyToken) safeReply(replyToken, {type:'text', text:'已收到，處理中…'});
}

async function handleCancel(sourceId, replyToken){
  if (pendingOrders.has(sourceId)) {
    pendingOrders.delete(sourceId);
    await safeReply(replyToken, {type:'text', text:'❌ 已取消報單'});
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('🚀 LAIGO Bot on', port));
