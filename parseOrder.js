
export default function parseOrder(text) {
  const lines = text.trim().split('\n').slice(1); // 去掉「報單」
  const get = (key) => lines.find(l => l.startsWith(key))?.split('：')[1]?.trim() || '';
  return {
    ig: get('a50240') || lines[1] || '',
    name: get('姓名') || '',
    phone: get('電話')?.replace(/[-\s]/g, '') || '',
    orderDate: new Date().toLocaleDateString('zh-TW'),
    product: lines.find(l => l.includes('雙藻'))?.replace(/[^\u4e00-\u9fa5🌿]/g, '') || '雙藻🌿',
    quantity: parseInt(lines.find(l => l.includes('盒'))?.match(/(\d+)盒/)?.[1] || 1),
    notes: lines.slice(1).join(' ')
  };
}
