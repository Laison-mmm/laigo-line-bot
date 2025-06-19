export function parseOrder(text) {
  const lines = text.trim().split('\n').map(l => l.trim());
  const raw = text;

  const inquiryDate = (lines.find(l => /^\d{6}/.test(l)) || '').slice(0, 6);
  const nameLine = lines.find(l => l.includes('姓名'));
  const phoneLine = lines.find(l => l.includes('電話'));
  const emailLine = lines.find(l => l.includes('信箱'));
  const addressLine = lines.find(l => l.includes('門市') || l.includes('地址'));
  const quantityLine = lines.find(l => l.includes('盒數') || /(\d+盒|[一二兩三四五六七八九十]+盒)/.test(l));
  const priceLine = lines.find(l => l.includes('價格') || l.includes('元'));

  const extract = (line, keyword) => (line || '').split(keyword)[1]?.trim() || '';

  const name = extract(nameLine, '姓名：');
  const phone = extract(phoneLine, '電話：');
  const email = extract(emailLine, '信箱：');
  const address = extract(addressLine, '門市：') || extract(addressLine, '地址：');

  const quantity = extract(quantityLine, '盒數：') || quantityLine || '';
  const price = priceLine || '';

  const ig = lines.find(line => /^[a-zA-Z0-9._]{4,}$/.test(line)) || '';

  // notes = 除了系統欄位之外的敘述
  const skipKeys = ['報單', '貨到', '刷卡', '姓名', '電話', '信箱', '門市', '地址', '盒數', '價格'];
  const notes = lines
    .filter(l => !skipKeys.some(k => l.includes(k)) && !/^\d{6}/.test(l) && l !== ig)
    .join('\n');

  return {
    raw,
    inquiryDate,
    name,
    phone,
    email,
    address,
    quantity,
    price,
    ig,
    notes,
  };
}
