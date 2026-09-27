// Formato argentino para importes y fechas.
import { addDays, parseISODate, todayISO } from './dates.js';

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const integerFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** 18000 → "$18.000"  ·  12.5 → "$12,50" */
export function formatMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const text = Number.isInteger(abs) ? integerFormat.format(abs) : decimalFormat.format(abs);
  return `${n < 0 ? '-' : ''}$${text}`;
}

/** Versión corta para espacios chicos: "$327k", "$1,2M" */
export function formatMoneyShort(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `$${percentFormat.format(n / 1_000_000)}M`;
  if (n >= 10_000) return `$${integerFormat.format(Math.round(n / 1000))}k`;
  return formatMoney(Math.round(n));
}

/** 12.4 → "12,4%" */
export function formatPercent(value) {
  return `${percentFormat.format(Number(value) || 0)}%`;
}

/** Texto para el input de importe: 18000 → "18.000" */
export function formatAmountInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return Number.isInteger(n) ? integerFormat.format(n) : decimalFormat.format(n);
}

/**
 * Interpreta lo que el usuario escribe en el importe, al estilo argentino:
 * "18.000" → 18000 · "18000" → 18000 · "12,50" → 12.5 · "$ 1.250.000" → 1250000
 * Devuelve NaN si no es un número.
 */
export function parseAmountInput(text) {
  let s = String(text ?? '').replace(/[$\s]/g, '');
  if (s === '') return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

/** "2026-09-26" → "26 Sep 2026" */
export function formatDate(iso) {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-09" → "Septiembre 2026" */
export function formatMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Hoy", "Ayer" o "Miércoles 24 Sep" */
export function formatRelativeDay(iso, { withYear = false } = {}) {
  const today = todayISO();
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  const d = parseISODate(iso);
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

/** Hora local a partir de un instante ISO: "13:42" */
export function formatTime(instant) {
  if (!instant) return '';
  return new Date(instant).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Quita tildes y pasa a minúsculas, para buscar sin importar cómo se escribió. */
export function normalizeText(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
