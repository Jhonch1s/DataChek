export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function status(student, date = today()) {
  if (student?.card_status === 'no_card') return 'No tiene';
  if (student?.card_status !== 'has_card') return 'Sin confirmar';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(student.card_expiry_month || '')) return 'Revisar';
  const [year, month] = student.card_expiry_month.split('-').map(Number);
  const [currentYear, currentMonth, currentDay] = date.split('-').map(Number);
  const days = Math.round((Date.UTC(year, month, 0) - Date.UTC(currentYear, currentMonth - 1, currentDay)) / 86400000);
  if (days < 0) return 'Vencido';
  return days <= 30 ? 'Próximo a vencer' : 'Vigente';
}

export function expiryLabel(value) {
  return value ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : 'Sin fecha';
}
