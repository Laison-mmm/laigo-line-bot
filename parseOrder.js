const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '兩': 2, '三': 3,
  '四': 4, '五': 5, '六': 6, '七': 7,
  '八': 8, '九': 9, '十': 10
};

export default function parseOrder(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const today = new Date();
  const orderDate = today.toLocaleDateString('zh-TW');
  const todayCode = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  let report = {
    ig: '', name: '', phone: '', inquiryDate: '', previewText: '',
    quantity: 1, orderDate, notes: text.trim()
  };

  for (let line of lines) {
    // 抓六碼開頭當作詢問日（例：250618 明天見）
    if (/^2\d{5}(?![\d\/])/.test(line) && !report.inquiryDate) {
      const match = line.match(/^(\d{6})\s*(.*)/);
      if (match) {
        report.inquiryDate = match[1];
        report.previewText = match[2]?.trim() || '';
      }
    }

    // 姓名
    if (/姓名[:：]/.test(line)) {
      report.name = line.split(/[:：]/)[1]?.trim() || '';
    }

    // 電話
    if (/電話[:：]/.test(line)) {
      report.phone = line.split(/[:：]/)[1]?.replace(/[-\s]/g, '').trim() || '';
    }

    // IG 帳號
    if (/^[a-zA-Z0-9._]{4,}$/.test(line) && !report.ig) {
      report.ig = line;
    }

    // 盒數解析（中英皆可）
    if (line.includes('盒')) {
      const numMatch = line.match(/(\d+)\s*盒/);
      if (numMatch) {
        report.quantity = parseInt(numMatch[1]);
      } else {
        const chineseText = line.replace(/[^一二三四五六七八九十兩]/g, '');
        for (let ch of chineseText) {
          if (CHINESE_NUM_MAP[ch]) {
            report.quantity = CHINESE_NUM_MAP[ch];
            break;
          }
        }
      }
    }
  }

  return report;
}
