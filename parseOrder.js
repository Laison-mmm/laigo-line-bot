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

  // 嘗試抓詢問日（六碼開頭）
  const firstLineMatch = lines[0]?.match(/(\d{6})/);
  if (firstLineMatch) {
    order.inquiryDate = firstLineMatch[1];
  }

  for (const line of lines) {
    if (/^姓名[:：]/.test(line)) order.name = line.split(/[:：]/)[1].trim();
    else if (/^電話[:：]/.test(line)) order.phone = line.split(/[:：]/)[1].replace(/-/g, '').trim();
    else if (/^信箱[:：]/.test(line)) order.email = line.split(/[:：]/)[1].trim();
    else if (/^(門市|地址)[:：]/.test(line)) order.address = line.split(/[:：]/)[1].trim();
    else if (/盒/.test(line)) {
      order.quantity = parseQuantity(line);
      order.notes += line + '\n';
    } else if (/^\d{10}$/.test(line.replace(/-/g, ''))) {
      order.phone = line.replace(/-/g, '');
    } else if (/^[a-zA-Z0-9._]+$/.test(line)) {
      order.ig = line.trim();
    } else {
      order.notes += line + '\n';
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
