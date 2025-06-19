function chineseToNumber(text) {
  const map = { '一':1, '二':2, '兩':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10 };
  return map[text] || parseInt(text) || 1;
}
module.exports = { chineseToNumber };
