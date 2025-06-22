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
const pendingOrders = new Map();

async function safeReply(token, message) {
  try {
    await client.replyMessage(token, message);
  } catch (err) {
    console.warn("⚠️ reply 失敗:", err.message);
  }
}

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
      const text = event.message?.text?.trim();
      const replyToken = event.replyToken;

      let sourceId;
      if (event.source.type === 'group') sourceId = event.source.groupId;
      else if (event.source.type === 'room') sourceId = event.source.roomId;
      else sourceId = event.source.userId;

      if (!sourceId || !replyToken) continue;

      if (event.type === "message" && event.message.type === "text") {
        if (text.startsWith("報單")) {
          let order;
          try {
            order = parseOrder(text);
            console.log("[解析結果] PV:", order.pv);
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
          console.log("[寫入前 finalOrder]", finalOrder);
          pendingOrders.set(sourceId, finalOrder);

          const flexMessage = {
            type: "flex",
            altText: "報單預覽：請在聊天室輸入『確定』或『取消』來完成操作。",
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "報單預覽", weight: "bold", size: "xl", margin: "md", color: "#1DB446" },
                  { type: "separator", margin: "lg" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    spacing: "sm",
                    contents: [
                      { type: "box", layout: "baseline", spacing: "sm", contents: [
                        { type: "text", text: "電話:", color: "#aaaaaa", size: "sm", flex: 1 },
                        { type: "text", text: finalOrder.phone, wrap: true, color: "#666666", size: "sm", flex: 4 }
                      ]},
                      { type: "box", layout: "baseline", spacing: "sm", contents: [
                        { type: "text", text: "IG:", color: "#aaaaaa", size: "sm", flex: 1 },
                        { type: "text", text: finalOrder.ig, wrap: true, color: "#666666", size: "sm", flex: 4 }
                      ]},
                      { type: "box", layout: "baseline", spacing: "sm", contents: [
                        { type: "text", text: "盒數:", color: "#aaaaaa", size: "sm", flex: 1 },
                        { type: "text", text: finalOrder.quantity, wrap: true, color: "#666666", size: "sm", flex: 4 }
                      ]},
                      { type: "box", layout: "baseline", spacing: "sm", contents: [
                        { type: "text", text: "PV:", color: "#aaaaaa", size: "sm", flex: 1 },
                        { type: "text", text: finalOrder.pv || "未提供", wrap: true, color: "#666666", size: "sm", flex: 4 }
                      ]},
                      { type: "box", layout: "baseline", spacing: "sm", contents: [
                        { type: "text", text: "備註:", color: "#aaaaaa", size: "sm", flex: 1 },
                        { type: "text", text: finalOrder.notes || "無", wrap: true, color: "#666666", size: "sm", flex: 4 }
                      ]},
                      { type: "text", text: "這筆資料要送出嗎？", wrap: true, margin: "md", size: "md", color: "#555555" }
                    ]
                  }
                ]
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                  { type: "button", style: "primary", height: "sm", action: { type: "postback", label: "確定", data: "action=confirm_order", displayText: "確定報單" }, color: "#1DB446" },
                  { type: "button", style: "secondary", height: "sm", action: { type: "postback", label: "取消", data: "action=cancel_order", displayText: "取消報單" }, color: "#AAAAAA" }
                ]
              }
            }
          };

          await safeReply(replyToken, flexMessage);
          continue;
        }

        if (text === "確定") {
          const finalOrder = pendingOrders.get(sourceId);
          if (!finalOrder || finalOrder.submitted) continue;

          try {
            finalOrder.submitted = true;
            await writeToSheet(finalOrder);
            await safePush(sourceId, { type: "text", text: `✅ 報單成功：${finalOrder.name} 已完成` });
          } catch (err) {
            console.error("❌ 寫入錯誤:", err.message);
            await safePush(sourceId, { type: "text", text: "❌ 系統錯誤，報單未完成，請稍後再試或聯絡客服" });
          } finally {
            pendingOrders.delete(sourceId);
          }
          continue;
        }

        if (text === "取消" && pendingOrders.has(sourceId)) {
          pendingOrders.delete(sourceId);
          await safeReply(replyToken, { type: "text", text: "❌ 已取消報單" });
          continue;
        }
      }

      if (event.type === "postback") {
        const postbackData = event.postback.data;

        if (postbackData === "action=confirm_order") {
          const finalOrder = pendingOrders.get(sourceId);
          if (!finalOrder || finalOrder.submitted) return;

          try {
            finalOrder.submitted = true;
            await writeToSheet(finalOrder);
            await safeReply(replyToken, { type: "text", text: `✅ 報單成功：${finalOrder.name} 已完成` });
          } catch (err) {
            console.error("❌ 寫入錯誤:", err.message);
            await safeReply(replyToken, { type: "text", text: "❌ 系統錯誤，報單未完成，請稍後再試或聯絡客服" });
          } finally {
            pendingOrders.delete(sourceId);
          }
          return;
        }

        if (postbackData === "action=cancel_order") {
          if (pendingOrders.has(sourceId)) {
            pendingOrders.delete(sourceId);
            await safeReply(replyToken, { type: "text", text: "❌ 已取消報單" });
          }
          return;
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ webhook 全域錯誤:", err);
    res.sendStatus(200);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("🚀 LAIGO Bot running on port", port);
});
