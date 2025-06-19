// ✅ parseOrder.js 改版 - 強化 notes 與日期格式處理
const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

export default function parseOrder(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const today = new Date();
  const orderDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  let report = {
    inquiryDate: '',
    previewText: '',
    ig: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    quantity: 1,
    orderDate,
    notes: ''
  };

  lines.forEach((line, index) => {
    // 詢問日 + 預覽文
    if (/^2\d{5}(?![\d\/])/.test(line) && !report.inquiryDate) {
      const m = line.match(/^(\d{6})\s*(.*)/);
      if (m) {
        report.inquiryDate = m[1];
        report.previewText = m[2] || '';
      }
    }
    // 姓名
    if (line.includes('姓名')) {
      report.name = line.split('姓名')[1]?.replace(/[:：]/, '').trim();
    }
    // 電話
    if (line.includes('電話')) {
      report.phone = line.split('電話')[1]?.replace(/[:：]/, '').replace(/[-\s]/g, '').trim();
    }
    // 信箱
    if (line.includes('信箱')) {
      report.email = line.split('信箱')[1]?.replace(/[:：]/, '').trim();
    }
    // 地址
    if (line.includes('門市') || line.includes('地址')) {
      report.address = line.split('：')[1]?.trim();
    }
    // 盒數
    if (line.includes('盒數')) {
      const qtyText = line.split('盒數')[1]?.replace(/[:：]/, '').replace(/[^\u4e00-\u9fa5\d]/g, '') || '';
      const match = qtyText.match(/\d+/);
      if (match) {
        report.quantity = parseInt(match[0]);
      } else {
        for (let ch of qtyText) {
          if (CHINESE_NUM_MAP[ch]) {
            report.quantity = CHINESE_NUM_MAP[ch];
            break;
          }
        }
      }
    }
    // IG 帳號（僅限英數混合，長度 4 以上）
    if (/^[a-zA-Z0-9._]{4,}$/.test(line) && !report.ig) {
      report.ig = line;
    }
  });

  // 補 notes（只抓症狀段）
  const noteStart = lines.findIndex(l => l.match(/^姓名[:：]/)) - 3;
  report.notes = lines.slice(Math.max(1, noteStart), noteStart + 3).join('\n');

  return report;
}
