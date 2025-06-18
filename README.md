# LAIGO Line 報單機器人

一個使用 Node.js + LINE Messaging API 製作的報單系統，能解析 LINE 使用者訊息並將資料寫入 Google Sheet。

---

## 📦 專案功能

- 接收 LINE 訊息 Webhook
- 判斷報單格式、自動分類
- 比對 IG / 電話 判定新客 / 追蹤 / 回購
- Google Apps Script API 寫入 Sheet

---

## 🚀 Render 部署教學

### 1️⃣ Fork 或下載此 Repo，並建立 Render Web Service

| 設定項目     | 建議填寫                     |
|--------------|------------------------------|
| Environment  | Node                         |
| Build Command| `npm install`                |
| Start Command| `node index.js`              |

---

### 2️⃣ 設定環境變數 `.env`

可參考 `.env.sample`，內容包含：

```
CHANNEL_SECRET=你的_LINE_channel_secret
CHANNEL_ACCESS_TOKEN=你的_LINE_access_token
SHEET_API_URL=https://script.google.com/macros/s/你的_GAS_URL/exec
```

---

### 3️⃣ 設定 Webhook

將以下網址貼至 LINE Developer Console Webhook：

```
https://你的-render-url.onrender.com/webhook
```

---

## 📂 檔案結構簡介

- `index.js`：主伺服器，處理 webhook
- `parseOrder.js`：格式解析器
- `confirmHandler.js`：確認寫入流程
- `sheetWriter.js`：與 Google Sheet 通訊
- `.env.sample`：環境變數模板
