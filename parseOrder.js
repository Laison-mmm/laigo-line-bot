const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

export default function parseOrder(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);

  const today = new Date();
  const orderDate = `${today.getMonth() + 1}/${today.getDate()}`;
  const report = {
    ig: '', name: '', phone: '', email: '', address: '',
    inquiryDate: '', previewText: '', quantity: 1, orderDate, notes: ''
  };

  // 詢問日與 previewText
  const dateMatch = lines.find(l => /^2\d{5}/.test(l));
  if (dateMatch) {
    const m = dateMatch.match(/^(\d{6})\s*(.*)/);
    if (m) {
      report.inquiryDate = m[1];
      report.previewText = m[2] || '';
    }
  }

  for (const line of lines) {
    if (/姓名[:：]/.test(line)) report.name = line.split(/[:：]/)[1]?.trim() || '';
    else if (/電話[:：]/.test(line)) report.phone = normalizePhone(line.split(/[:：]/)[1]);
    else if (/信箱[:：]/.test(line)) report.email = line.split(/[:：]/)[1]?.trim() || '';
    else if (/^(門市|地址)[:：]/.test(line)) report.address = line.split(/[:：]/)[1]?.trim() || '';
    else if (/^[a-zA-Z0-9._]{4,}$/.test(line) && !report.ig) report.ig = line.trim();
    else if (line.includes('盒')) report.quantity = parseQuantity(line);
  }

  // 備註欄（過濾不需要的欄位標籤）
  report.notes = lines
    .filter(l =>
      !/^報單/.test(l) &&
      !/^2\d{5}/.test(l) &&
      !/姓名|電話|信箱|門市|地址|價格|盒數/.test(l) &&
      !/^[a-zA-Z0-9._]{4,}$/.test(l)
    )
    .join('\n');

  return report;
}

function normalizePhone(str) {
  const digits = String(str || '').replace(/\D/g, '');
  if (digits.length === 9) return '0' + digits;
  if (digits.length === 10) return digits;
  return '';
}

function parseQuantity(text) {
  const match = text.match(/[一二兩三四五六七八九十\d]+/);
  if (!match) return 1;
  const raw = match[0];
  return /^\d+$/.test(raw) ? parseInt(raw) : (CHINESE_NUM_MAP[raw] || 1);
}
