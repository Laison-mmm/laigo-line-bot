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
      const text = event.message?.text?.trim(); // 確保 message 和 text 存在
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

      if (!sourceId || !replyToken) continue; // 確保 sourceId 和 replyToken 存在

      // --- 處理文字訊息 ---
      if (event.type === "message" && event.message.type === "text") {
        // 🟡 處理報單
        if (text.startsWith("報單")) {
          let order;
          try {
            order = parseOrder(text);
          } catch (err) {
            await safeReply(replyToken, { type: "text", text: "❌ 無法解析報單內容，請檢查格式" });
            return; // 修正：解析失敗後直接 return
          }

          const missing = [];
          if (!order.ig) missing.push("IG");
          if (!order.name) missing.push("姓名");
          if (!order.phone) missing.push("電話");
          if (!order.inquiryDate) missing.push("詢問日");
          if (!order.quantity) missing.push("盒數");

          if (missing.length > 0) {
            await safeReply(replyToken, { type: "text", text: `❌ 缺少欄位：${missing.join("、")}` });
            return; // 修正：缺少欄位後直接 return
          }

          const checkResult = await verifyCustomer(order);
          const finalOrder = { ...order, ...checkResult, submitted: false };
          // 使用正確的 sourceId 作為 key 儲存待確認訂單
          pendingOrders.set(sourceId, finalOrder);

          // Flex Message for preview
          const flexMessage = {
            "type": "flex",
            "altText": "報單預覽：請點擊『確定』或『取消』按鈕來完成操作。", // 更新 altText
            "contents": {
              "type": "bubble",
              "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                  {
                    "type": "text",
                    "text": "報單預覽",
                    "weight": "bold",
                    "size": "xl",
                    "margin": "md",
                    "color": "#1DB446"
                  },
                  {
                    "type": "separator",
                    "margin": "lg"
                  },
                  {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "lg",
                    "spacing": "sm",
                    "contents": [
                      {
                        "type": "box",
                        "layout": "baseline",
                        "spacing": "sm",
                        "contents": [
                          {
                            "type": "icon",
                            "url": "https://scdn.line-apps.com/n/channel_icon/190x190/07_1_000000.png",
                            "size": "sm"
                          },
                          {
                            "type": "text",
                            "text": `${finalOrder.inquiryDate}｜${finalOrder.name}`, // 動態替換報單資訊
                            "wrap": true,
                            "color": "#333333",
                            "size": "md",
                            "flex": 5
                          }
                        ]
                      },
                      {
                        "type": "text",
                        "text": "這筆資料要送出嗎？",
                        "wrap": true,
                        "margin": "md",
                        "size": "md",
                        "color": "#555555"
                      }
                    ]
                  }
                ]
              },
              "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "lg", // 增加按鈕間距，從 md 改為 lg
                "contents": [
                  {
                    "type": "button",
                    "style": "primary",
                    "height": "sm",
                    "action": {
                      "type": "postback",
                      "label": "確定",
                      "data": "action=confirm_order",
                      "displayText": "確定報單"
                    },
                    "color": "#1DB446"
                  },
                  {
                    "type": "button",
                    "style": "secondary",
                    "height": "sm",
                    "action": {
                      "type": "postback",
                      "label": "取消",
                      "data": "action=cancel_order",
                      "displayText": "取消報單"
                    },
                    "color": "#AAAAAA"
                  }
                ]
              }
            }
          };
          await safeReply(replyToken, flexMessage);
          return; // 修正：發送 Flex Message 後直接 return
        }

        // 🟢 確認送出 (文字版，已移除)
        // 🔴 取消報單 (文字版，已移除)
      }

      // --- 處理 Postback 事件 ---
      if (event.type === "postback") {
        const postbackData = event.postback.data; // 獲取按鈕中設定的 data

        if (postbackData === "action=confirm_order") {
          const finalOrder = pendingOrders.get(sourceId);
          if (!finalOrder || finalOrder.submitted) {
            console.warn("⚠️ 已送出或資料不存在，跳過");
            // 這裡不需要 reply，因為用戶已經點擊了按鈕，且可能沒有新的 replyToken
            return;
          }

          try {
            finalOrder.submitted = true;
            await writeToSheet(finalOrder);
            console.log(`準備推播報單成功訊息給 ${sourceId}`);
            // 透過 safeReply 發送成功訊息，取代 Flex Message
            await safeReply(replyToken, {
              type: "text",
              text: `✅ 報單成功：${finalOrder.name} 已完成`,
            });

          } catch (err) {
            console.error("❌ 寫入錯誤:", err.message);
            console.log(`準備推播報單失敗訊息給 ${sourceId}`);
            // 失敗時仍然透過 safeReply 回覆錯誤訊息
            await safeReply(replyToken, {
              type: "text",
              text: "❌ 系統錯誤，報單未完成，請稍後再試或聯絡客服",
            });
          } finally {
            pendingOrders.delete(sourceId);
          }
          return;
        }

        if (postbackData === "action=cancel_order") {
          if (pendingOrders.has(sourceId)) {
            pendingOrders.delete(sourceId);
            await safeReply(replyToken, {
              type: "text",
              text: "❌ 已取消報單",
            });
          }
          return;
        }
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


