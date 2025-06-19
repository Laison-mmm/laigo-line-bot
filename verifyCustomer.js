
import fetch from 'node-fetch';

const SHEET_API_URL = process.env.SHEET_API_URL;
const PRODUCT_NAME = '雙藻🌿';
const CHANNEL = 'IG';

function parseChineseNumber(text) {
  const map = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const match = text.match(/[一二兩三四五六七八九十\d]+/);
  if (!match) return 1;
  const raw = match[0];
  if (/^\d+$/.test(raw)) return parseInt(raw);
  return map[raw] || 1;
}

export default async function verifyCustomer(order) {
  try {
    const res = await fetch(SHEET_API_URL);
    const rows = await res.json();
    const header = rows[0];
    const data = rows.slice(1);

    const igCol = header.indexOf('IG帳號');
    const nameCol = header.indexOf('姓名');
    const phoneCol = header.indexOf('電話');

    const rowIndex = data.findIndex(row =>
      row[igCol]?.toString().trim() === order.ig &&
      row[nameCol]?.toString().trim() === order.name &&
      row[phoneCol]?.toString().trim() === order.phone
    );

    if (rowIndex !== -1) {
      const baseRow = rowIndex + 1;
      const offset = 10 + (3 * getRepurchaseIndex(data[rowIndex]));
      return {
        type: 'repurchase',
        rowIndex: baseRow,
        startCol: offset + 1,
        orderDate: order.orderDate,
        product: PRODUCT_NAME,
        quantity: order.quantity
      };
    }

    const level = decideLevel(data, order);
    return {
      type: 'new',
      level,
      channel: CHANNEL,
      inquiryDate: order.inquiryDate,
      ig: order.ig,
      name: order.name,
      phone: order.phone,
      orderDate: order.orderDate,
      product: PRODUCT_NAME,
      quantity: order.quantity,
      notes: order.notes
    };
  } catch (error) {
    console.error('❌ verifyCustomer 錯誤：', error);
    throw error;
  }
}

function getRepurchaseIndex(row) {
  for (let i = 10; i < row.length; i += 3) {
    if (!row[i] && !row[i + 1] && !row[i + 2]) return (i - 10) / 3;
  }
  return 0;
}

function decideLevel(data, order) {
  const exists = data.some(row =>
    row.includes(order.ig) || row.includes(order.name) || row.includes(order.phone)
  );
  if (exists) return '已回購';
  const today = new Date();
  const y = today.getFullYear().toString().slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayCode = `${y}${m}${d}`;
  return order.inquiryDate === todayCode ? '新客' : '追蹤';
}
