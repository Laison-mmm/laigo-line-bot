// ✅ parseOrder.js（已修正：正確抓 inquiryDate 與 preview）

function parseOrder(msg) {
  const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);
  const order = {
    inquiryDate: '',
    previewText: '',
    ig: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    quantity: 1,
    notes: '',
  };

  const CHINESE_NUM_MAP = {
    '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };

  lines.forEach((line, i) => {
    order.notes += line + ' ';

    // 🔍 抓 inquiryDate（6 碼）
    if (/^\d{6}(\s+.*)?$/.test(line) && !order.inquiryDate) {
      const [code, preview] = line.split(/\s+/, 2);
      order.inquiryDate = code;
      order.previewText = preview || '';
    }

    if (line.includes('姓名')) order.name = line.split('姓名：')[1]?.trim();
    if (line.includes('電話')) order.phone = line.split('電話：')[1]?.replace(/[-\s]/g, '').trim();
    if (line.includes('信箱')) order.email = line.split('信箱：')[1]?.trim();
    if (line.includes('門市') || line.includes('地址')) order.address = line.split('：')[1]?.trim();

    // 🔢 抓盒數
    if (line.includes('盒數')) {
      const qtyText = line.split('盒數：')[1]?.replace(/[^一-龥\d]/g, '') || '';
      const digit = qtyText.match(/\d+/);
      if (digit) order.quantity = parseInt(digit[0]);
      else {
        for (let ch of qtyText) {
          if (CHINESE_NUM_MAP[ch]) {
            order.quantity = CHINESE_NUM_MAP[ch];
            break;
          }
        }
      }
    }

    // 👤 抓 IG（符合帳號格式）
    if (/^[a-zA-Z0-9._]{4,}$/.test(line) && !order.ig) order.ig = line;
  });

  return order;
}

module.exports = parseOrder;
