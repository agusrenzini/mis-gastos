// Fechas "de calendario" como texto ISO (2026-09-26), siempre en la hora local del teléfono.
// Evitamos new Date('2026-09-26') porque JavaScript la interpreta en UTC y puede correrse un día.

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "Hoy" siempre en hora argentina, igual que el servidor (aunque el teléfono esté en otra zona horaria).
const ARGENTINA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayISO() {
  return ARGENTINA_DATE.format(new Date());
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** "2026-09" */
export function monthOf(iso) {
  return iso.slice(0, 7);
}

export function addMonths(yearMonth, months) {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function monthRange(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${yearMonth}-01`, to: `${yearMonth}-${pad(last)}` };
}

/** 0 = domingo ... 6 = sábado (como Date.getDay) */
export function weekdayOf(iso) {
  return parseISODate(iso).getDay();
}
