export function normalizePhone(str) {
  const digits = String(str || '').replace(/\D/g, '');
  if (digits.length === 9) return '0' + digits;
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  return ''; // 防錯：不合法號碼直接丟掉
}
