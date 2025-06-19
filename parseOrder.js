const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

export default function parseOrder(text) {
  const lines = text.trim().split('\n');
  const today = new Date().toLocaleDateString('zh-TW');
  let inquiryDate = '', previewText = '', ig = '', quantity = 1;

  for (let line of lines) {
    const match = line.match(/^2\d{5}\s*(.*)/); // 合法六碼詢問日開頭
    if (match) {
      inquiryDate = line.slice(0, 6);
      previewText = match[1]?.trim() || '';
    }
    if (!ig && /^[a-zA-Z0-9._]{4,}$/.test(line)) ig = line.trim();
    if (line.includes('盒數')) {
      const raw = line.split('盒數：')[1]?.replace(/[^\u4e00-\u9fa5\d]/g, '') || '';
      const num = raw.match(/\d+/);
      if (num) quantity = parseInt(num[0]);
      else {
        for (let ch of raw) {
          if (CHINESE_NUM_MAP[ch]) {
            quantity = CHINESE_NUM_MAP[ch];
            break;
          }
        }
      }
    }
  }

  const get = (key) => lines.find(l => l.startsWith(key))?.split('：')[1]?.trim() || '';
  const name = get('姓名');
  const phone = get('電話')?.replace(/[-\s]/g, '') || '';
  const email = get('信箱');
  const address = get('門市') || get('地址');
  const product = lines.find(l => l.includes('雙藻'))?.replace(/[^一-\u9fa5🌿]/g, '') || '雙藻🌿';
  const notes = lines.slice(2).join(' ');

  return {
    ig,
    name,
    phone,
    email,
    address,
    inquiryDate,
    previewText,
    product,
    quantity,
    orderDate: today,
    notes
  };
}
