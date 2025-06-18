
import fetch from 'node-fetch';

export default async function writeToSheet(order) {
  const payload = {
    level: order.level,
    channel: order.channel,
    inquiryDate: order.inquiryDate,
    ig: order.ig,
    name: order.name,
    phone: order.phone,
    orderDate: order.orderDate,
    product: order.product,
    quantity: order.quantity,
    notes: order.notes,
  };
  await fetch('https://script.google.com/macros/s/AKfycbx2pvAMpiBaKQGdymsPU4BCSRp7HRb_WXyeJprm-wKG4z0NIYesvf2wO2yKTdni6qV4bA/exec', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}
