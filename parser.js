const { chineseToNumber } = require('./utils');

function parseOrder(text) {
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
  const data = {
    raw: text,
    inquiryDate: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    quantity: '',
    ig: '',
    price: '',
    notes: ''
  };

  for (const line of lines) {
    // ✅ 只抓第一個出現的 6 碼數字作為 inquiryDate（避免 024045 蓋掉）
    if (!data.inquiryDate && /\d{6}/.test(line)) {
      data.inquiryDate = line.match(/\d{6}/)[0];
    }

    if (/姓名[:：]/.test(line)) data.name = line.split(/[:：]/)[1];
    if (/電話[:：]/.test(line)) data.phone = line.split(/[:：]/)[1].replace(/[-\s]/g, '');
    if (/信箱[:：]/.test(line)) data.email = line.split(/[:：]/)[1];
    if (/^(門市|地址)/.test(line)) data.address = line.replace(/(門市|地址)[:：]/, '');

    // ✅ 支援中文數字盒數轉換
    if (/盒/.test(line)) {
      const match = line.match(/(\d+|[一二兩三四五六七八九十]+)/);
      if (match) data.quantity = chineseToNumber(match[0]);
    }

    if (/^[a-zA-Z0-9._]+$/.test(line)) data.ig = line;
    if (/價格/.test(line)) data.price = line;

    if (!line.includes('姓名') && !line.includes('電話') && !line.includes('信箱') &&
        !line.includes('門市') && !line.includes('盒') && !line.includes('價格') &&
        !/\d{6}/.test(line) && !/^[a-zA-Z0-9._]+$/.test(line)) {
      data.notes += line + '\n';
    }
  }

  return data;
}

module.exports = { parseOrder };
