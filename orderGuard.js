// orderGuard.js

function finalGuard(order) {
  const problems = [];

  const phone = String(order.phone || '').trim();
  const orderDate = String(order.orderDate || '').trim();

  // ❶ 電話格式錯誤（不是10碼數字）
  if (!/^\d{10}$/.test(phone)) {
    problems.push(`❌ 電話格式錯誤（需 10 碼數字）：${phone}`);
  }

  // ❷ 訂購日格式錯誤（不是 M/D）
  if (!/^\d{1,2}\/\d{1,2}$/.test(orderDate)) {
    problems.push(`❌ 訂購日格式錯誤（應為 M/D，例如 6/21）：${orderDate}`);
  }

  // ❸ 電話進表格少 0 的情境防呆（如果是 9 碼，且第一碼不是 0）
  if (/^\d{9}$/.test(phone)) {
    problems.push(`⚠️ 電話僅 9 碼，可能已掉前導 0：${phone}`);
  }

  // ✅ 結果處理
  if (problems.length > 0) {
    console.warn('🧯 orderGuard 檢查異常：\n' + problems.join('\n'));
  } else {
    console.log('✅ orderGuard 檢查通過');
  }
}

module.exports = { finalGuard };
