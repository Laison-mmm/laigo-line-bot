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
    if (/\d{6}/.test(line)) data.inquiryDate = line.match(/\d{6}/)[0];
    if (/姓名[:：]/.test(line)) data.name = line.split(/[:：]/)[1];
    if (/電話[:：]/.test(line)) data.phone = line.split(/[:：]/)[1].replace(/[-\s]/g, '');
    if (/信箱[:：]/.test(line)) data.email = line.split(/[:：]/)[1];
    if (/^(門市|地址)/.test(line)) data.address = line.replace(/(門市|地址)[:：]/, '');
    if (/盒/.test(line)) data.quantity = line.match(/(\d+|[一二兩三四五六七八九十]+)/)?.[0];
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
