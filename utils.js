function chineseToNumber(text) {
  const map = { '零': 0, '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const unit = { '十': 10 };

  if (/^\d+$/.test(text)) return parseInt(text); // 阿拉伯數字，直接轉

  let result = 0;

  if (text.length === 1) {
    return map[text] || 1; // 單字，例如「八」
  }

  // 支援「十一」「二十」「二十三」
  let tenIndex = text.indexOf('十');
  if (tenIndex !== -1) {
    const left = text.substring(0, tenIndex);
    const right = text.substring(tenIndex + 1);

    result += (map[left] || 1) * 10;
    if (right) result += map[right] || 0;
    return result;
  }

  return map[text] || 1; // fallback
}

module.exports = { chineseToNumber };
