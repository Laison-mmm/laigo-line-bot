const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '兩': 2, '三': 3,
  '四': 4, '五': 5, '六': 6, '七': 7,
  '八': 8, '九': 9, '十': 10
};

export default function parseOrder(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const today = new Date();
  const orderDate = `${today.getMonth() + 1}/${today.getDate()}`;
  const todayCode = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  let report = {
    ig: '', name: '', phone: '', email: '', address: '',
    inquiryDate: '', previewText: '', quantity: 1, orderDate, notes: ''
  };

  for (let line of lines) {
    // ✅ 擷取詢問日（六碼）與說明（如：明天見）
    if (/^2\d{5}(?![\d\/])/.test(line) && !report.inquiryDate) {
      const match = line.match(/^(\d{6})\s*(.*)/);
      if (match) {
        report.inquiryDate = match[1];
        report.previewText = match[2]?.trim() || '';
      }
    }

    if (/姓名[:：]/.test(line)) {
      report.name = line.split(/[:：]/)[1]?.trim() || '';
    }

    if (/電話[:：]/.test(line)) {
      let phone = line.split(/[:：]/)[1]?.replace(/[-\s]/g, '').trim() || '';
      if (/^\d{9}$/.test(phone)) phone = '0' + phone;
      if (!/^\d{10}$/.test(phone)) phone = ''; // ❌ 防呆：非10碼一律清空
      report.phone = phone;
    }

    if (/信箱[:：]/.test(line)) {
      report.email = line.split(/[:：]/)[1]?.trim() || '';
    }

    if (/^(門市|地址)[:：]/.test(line)) {
      report.address = line.split(/[:：]/)[1]?.trim() || '';
    }

    if (/^[a-zA-Z0-9._]{4,}$/.test(line) && !report.ig) {
      report.ig = line;
    }

    if (line.includes('盒')) {
      // 支援「8盒」或「雙藻錠八盒」
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

  // ✅ notes 欄位：排除系統欄位關鍵字，保留自然語句
  report.notes = lines
    .filter(l =>
      !/^報單/.test(l) &&
      !/^2\d{5}/.test(l) && // 詢問日行
      !/姓名|電話|信箱|門市|地址|價格|盒數/.test(l)
    )
    .join('\n');

  // ✅ 防呆補齊：若詢問日未抓到，預設用今日碼
  if (!report.inquiryDate) report.inquiryDate = todayCode;

  return report;
}
