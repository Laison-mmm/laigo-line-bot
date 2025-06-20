const express = require("express");
const { middleware, Client } = require("@line/bot-sdk");
const dotenv = require("dotenv");
const { parseOrder } = require("./parser");
const { verifyCustomer } = require("./verifyCustomer");
const { writeToSheet } = require("./sheetWriter");

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();
const client = new Client(config);
// pendingOrders 現在使用 sourceId (userId, groupId, 或 roomId) 作為 key
const pendingOrders = new Map();

// ✅ 安全 reply（token 過期不會炸）
async function safeReply(token, message) {
  try {
    await client.replyMessage(token, message);
  } catch (err) {
    console.warn("⚠️ reply 失敗（可能已用過）:", err.message);
  }
}

// ✅ 安全 push（封裝失敗防爆）
// 現在接受 sourceId，可以是 userId, groupId, 或 roomId
async function safePush(sourceId, message) {
  console.log(`嘗試推播訊息到: ${sourceId}, 訊息內容: ${JSON.stringify(message)}`);
  try {
    await client.pushMessage(sourceId, message);
    console.log(`✅ 成功推播訊息到: ${sourceId}`);
  } catch (err) {
    console.error(`❌ 推播訊息失敗到: ${sourceId}, 錯誤:`, err.message);
  }
}

app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;

  try {
    for (const event of events) {
      // ✅ 防止非 message 類型或非文字訊息觸發
      if (event.type !== "message" || event.message.type !== "text") continue;

      const text = event.message.text.trim();
      const replyToken = event.replyToken;

      // 修正 sourceId 取得邏輯：根據來源類型取得正確的 ID
      let sourceId;
      if (event.source.type === 'group') {
        sourceId = event.source.groupId;
      } else if (event.source.type === 'room') {
        sourceId = event.source.roomId;
      } else { // user
        sourceId = event.source.userId;
      }

      if (!text || !sourceId || !replyToken) continue;

      // 🟡 處理報單
      if (text.startsWith("報單")) {
        let order;
        try {
          order = parseOrder(text);
        } catch (err) {
          await safeReply(replyToken, { type: "text", text: "❌ 無法解析報單內容，請檢查格式" });
          continue;
        }

        const missing = [];
        if (!order.ig) missing.push("IG");
        if (!order.name) missing.push("姓名");
        if (!order.phone) missing.push("電話");
        if (!order.inquiryDate) missing.push("詢問日");
        if (!order.quantity) missing.push("盒數");

        if (missing.length > 0) {
          await safeReply(replyToken, { type: "text", text: `❌ 缺少欄位：${missing.join("、")}` });
          continue;
        }

        const checkResult = await verifyCustomer(order);
        const finalOrder = { ...order, ...checkResult, submitted: false };
        // 使用正確的 sourceId 作為 key 儲存待確認訂單
        pendingOrders.set(sourceId, finalOrder);

        const preview = `👤 ${finalOrder.inquiryDate}｜${finalOrder.name}\n這筆資料要送出嗎？\n✅ 請輸入「確定」\n❌ 請輸入「取消」`;
        await safeReply(replyToken, { type: "text", text: preview });
        continue;
      }

      // 🟢 確認送出
      if (text === "確定") {
        // 從正確的 sourceId 取得待確認訂單
        const finalOrder = pendingOrders.get(sourceId);
        if (!finalOrder || finalOrder.submitted) {
          console.warn("⚠️ 已送出或資料不存在，跳過");
          continue;
        }

        try {
          finalOrder.submitted = true;
          await writeToSheet(finalOrder);
          console.log(`準備推播報單成功訊息給 ${sourceId}`);
          // 推播訊息到正確的 sourceId (個人或群組)
          await safePush(sourceId, {
            type: "text",
            text: `✅ 報單成功：${finalOrder.name} 已完成`,
          });
        } catch (err) {
          console.error("❌ 寫入錯誤:", err.message);
          console.log(`準備推播報單失敗訊息給 ${sourceId}`);
          await safePush(sourceId, {
            type: "text",
            text: "❌ 系統錯誤，報單未完成，請稍後再試或聯絡客服",
          });
        } finally {
          pendingOrders.delete(sourceId); // 無論成功或失敗都清掉
        }

        continue;
      }

      // 🔴 取消報單
      if (text === "取消" && pendingOrders.has(sourceId)) {
        pendingOrders.delete(sourceId);
        await safeReply(replyToken, {
          type: "text",
          text: "❌ 已取消報單",
        });
        continue;
      }
    }

    res.sendStatus(200); // ✅ 保證 webhook 回 200，避免 LINE 重送
  } catch (err) {
    console.error("❌ webhook 全域錯誤:", err);
    res.sendStatus(200); // ❗照樣回 200，讓 LINE 不重送
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("🚀 LAIGO Bot running on port", port);
});
