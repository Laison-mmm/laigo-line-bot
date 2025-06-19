// ✅ 最新版 verifyCustomer.js
import { getSheetData } from './utils/sheetUtil.js';

const SHEET_NAME = 'Q2買賣';

export default async function verifyCustomer(order) {
  const { ig, name, phone, inquiryDate } = order;

  if (!ig || !name || !phone || !inquiryDate) {
    throw new Error('❌ verifyCustomer：缺少欄位');
  }

  const sheet = await getSheetData(SHEET_NAME);
  const matched = sheet.find(row =>
    row[3] === ig && row[4] === name && row[5] === phone
  );

  const todayCode = getTodayCode(); // 取得 yyMMdd
  const level = matched ? '已回購' : (inquiryDate === todayCode ? '新客' : '追蹤');

  return { level };
}
