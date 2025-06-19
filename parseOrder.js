
export default function parseOrder(text) {
  const lines = text.trim().split('
').map(l => l.trim()).filter(l => l);
  const report = {
    inquiryDate: '',
    ig: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    quantity: 1,
    orderDate: '',
    notes: ''
  };

  report.inquiryDate = (lines.find(l => /^\d{6}/.test(l)) || '').slice(0, 6);
  report.ig = (lines.find(l => /^[a-zA-Z0-9_\.]+$/.test(l)) || '').trim();

  lines.forEach(line => {
    if (/姓名/.test(line)) report.name = line.replace(/.*姓名[:：]?\s*/, '').trim();
    if (/電話/.test(line)) {
      let tel = line.replace(/.*電話[:：]?\s*/, '').replace(/-/g, '').trim();
      report.phone = tel.length === 9 ? '0' + tel : tel;
    }
    if (/信箱/.test(line)) report.email = line.replace(/.*信箱[:：]?\s*/, '').trim();
    if (/門市|地址/.test(line)) report.address = line.replace(/.*[:：]?\s*/, '').trim();
    if (/盒數/.test(line)) {
      const match = line.match(/[一二兩三四五六七八九十\d]+/);
      if (match) {
        const map = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
        const raw = match[0];
        report.quantity = /^\d+$/.test(raw) ? parseInt(raw) : (map[raw] || 1);
      }
    }
  });

  report.notes = lines
    .filter(l =>
      !/^報單/.test(l) &&
      !/^2\d{5}/.test(l) &&
      !/姓名|電話|信箱|門市|地址|價格|盒數/.test(l) &&
      l !== report.ig
    )
    .join('\n');

  const today = new Date();
  report.orderDate = `${today.getMonth() + 1}/${today.getDate()}`;

  return report;
}
