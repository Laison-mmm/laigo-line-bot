import { google } from 'googleapis';
import { auth } from './googleAuth.js';
import dayjs from 'dayjs';

const SHEET_NAME = 'Q2買賣';
const PRODUCT_NAME = '雙藻🌿';
const CHANNEL = 'IG';

export async function writeToSheet(order) {
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const { rowIndex, level } = order;
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: `${SHEET_NAME}!A1:AA`,
    });

    const rows = getRes.data.values || [];

    // 1️⃣ rowIndex 防呆：如果越界或行為空，直接報錯
    if (rowIndex === undefined || rowIndex + 1 >= rows.length || !rows[rowIndex + 1]) {
      throw new Error(`❌ rowIndex 超出範圍或空行：rowIndex=${rowIndex}, total=${rows.length}`);
    }

    const today = dayjs().format('M/D');
    const row = rows[rowIndex + 1]; // 實際行，因 A1 是表頭
    const updateRange = `${SHEET_NAME}!K${rowIndex + 2}:M${rowIndex + 2}`; // 寫入 K ~ M 欄

    // 2️⃣ 找回購欄位（每 3 欄為一組）
    let startCol = 10; // 從 K 開始
    while (row[startCol] && row[startCol + 1] && row[startCol + 2]) {
      startCol += 3;
    }

    const colLetter = indexToColumn(startCol); // K ~ AA
    const range = `${SHEET_NAME}!${colLetter}${rowIndex + 2}:${indexToColumn(startCol + 2)}${rowIndex + 2}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[today, PRODUCT_NAME, order.quantity]],
      },
    });

    // 3️⃣ 等級改成已回購
    const levelCell = `${SHEET_NAME}!A${rowIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: levelCell,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['已回購']],
      },
    });

    return { success: true };
  } catch (err) {
    throw new Error(`❌ 寫入失敗（sheetWriter）：${err.message}`);
  }
}

function indexToColumn(index) {
  let s = '', t = index;
  while (t >= 0) {
    s = String.fromCharCode((t % 26) + 65) + s;
    t = Math.floor(t / 26) - 1;
  }
  return s;
}
