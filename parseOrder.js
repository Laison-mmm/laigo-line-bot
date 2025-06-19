const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '兩': 2, '三': 3,
  '四': 4, '五': 5, '六': 6, '七': 7,
  '八': 8, '九': 9, '十': 10
};

export default function parseOrder(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const today = new Date();
  const orderDate = `${today.getMonth() + 1}/${today.getDate()}`; // ✅ m/d 格式
  const todayCode = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  let report = {
    ig: '', name: '', phone: '', inquiryDate: '', previewText: '',
    quantity: 1, orderDate, notes: ''
  };

  for (let line of lines) {
    // 詢問日：六碼開頭
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

    // 電話（補 0）
    if (/電話[:：]/.test(line)) {
      let phone = line.split(/[:：]/)[1]?.replace(/[-\s]/g, '').trim() || '';
      if (/^\d{9}$/.test(phone)) phone = '0' + phone;
      report.phone = phone;
    }

    // IG 帳號
    if (/^[a-zA-Z0-9._]{4,}$/.test(line) && !report.ig) {
      report.ig = line;
    }

    // 盒數（中英數字轉換）
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

  // 備註欄保留所有敘述（排除表頭與欄位標籤）
  report.notes = lines
    .filter(l =>
      !/^報單/.test(l) &&
      !l.includes('盒數') &&
      !/姓名|電話|信箱|門市|地址/.test(l)
    )
    .join('\n');

  return report;
}
