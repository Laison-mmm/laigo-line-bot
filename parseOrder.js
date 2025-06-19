
export default function parseOrder(text) {
  const lines = text.trim().split('\n');

  const order = {
    ig: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    quantity: 1,
    price: '',
    inquiryDate: '',
    notes: '',
  };

  // 嘗試抓詢問日（六碼）從所有行
  for (const line of lines) {
    if (!order.inquiryDate) {
      const match = line.match(/\b\d{6}\b/);
      if (match) order.inquiryDate = match[0];
    }
  }

  let notesStarted = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^姓名[:：]/.test(trimmed)) order.name = trimmed.split(/[:：]/)[1].trim();
    else if (/^電話[:：]/.test(trimmed)) {
      const number = trimmed.split(/[:：]/)[1].replace(/-/g, '').trim();
      if (/^\d{9,10}$/.test(number)) order.phone = number.padStart(10, '0');
    }
    else if (/^信箱[:：]/.test(trimmed)) order.email = trimmed.split(/[:：]/)[1].trim();
    else if (/^(門市|地址)[:：]/.test(trimmed)) order.address = trimmed.split(/[:：]/)[1].trim();
    else if (/盒/.test(trimmed)) {
      order.quantity = parseQuantity(trimmed);
      notesStarted = false;
    } else if (/^[a-zA-Z0-9._]+$/.test(trimmed)) {
      order.ig = trimmed;
    } else if (/^\d{9,10}$/.test(trimmed.replace(/-/g, ''))) {
      order.phone = trimmed.replace(/-/g, '').padStart(10, '0');
    } else {
      // 收集備註：過濾掉報單、付款、日期等無用行
      if (!/^報單$/.test(trimmed) &&
          !/^貨到$|^刷卡$/.test(trimmed) &&
          !/^\d{6}/.test(trimmed) &&
          !/^價格[:：]/.test(trimmed)) {
        order.notes += trimmed + '\n';
      }
    }
  }

  order.notes = order.notes.trim();
  return order;
}

function parseQuantity(text) {
  const map = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const match = text.match(/[一二兩三四五六七八九十\d]+/);
  if (!match) return 1;
  const raw = match[0];
  if (/^\d+$/.test(raw)) return parseInt(raw);
  return map[raw] || 1;
}
