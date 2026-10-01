// Interpreta una frase dicha o escrita como un movimiento: ingreso o egreso.
//   "Cobré 800 mil de sueldo"            → ingreso recibido, tipo sueldo
//   "Me ingresaron 25 mil por un trabajo" → ingreso recibido, trabajo extra
//   "Gasté 12 mil en supermercado"        → egreso (Comida)
//   "Pagué 8 mil de internet"             → egreso (Hogar)
// Si no queda claro si es ingreso o egreso, kind = null y la pantalla le pide a la persona que elija.
// Nunca guarda nada: solo prepara los datos para que se revisen antes de confirmar.

import { todayISO } from '../dates.js';
import { clean, fallbackDescription, parseExpense, strip, wordsToDigits } from './expense-parser.js';

// Verbos que indican que entró plata. "me cobraron" es un egreso: no coincide con \bcobre\b.
const INCOME_VERBS = /\b(cobre|cobramos|me pagaron|nos pagaron|me depositaron|me transfirieron|me ingreso|me ingresaron|ingreso|ingresaron|me entro|me entraron|recibi|recibimos|gane|ganamos|me liquidaron|voy a cobrar|vamos a cobrar|me van a pagar|me van a depositar|me tienen que pagar|tengo que cobrar|espero cobrar)\b/;
// Verbos que indican que salió plata.
const EXPENSE_VERBS = /\b(gaste|gastamos|gasto|pague|pagamos|compre|compramos|me cobraron|nos cobraron|me cobro|nos cobro|salio|salieron|costo|abone|invertí|inverti|transferi a|le pague)\b/;
// Ingreso que todavía no se cobró (queda como esperado).
const FUTURE_INCOME = /\b(voy a cobrar|vamos a cobrar|me van a pagar|me van a depositar|me tienen que pagar|tengo que cobrar|espero cobrar|cobro el|me pagan el)\b/;

// Pistas sin verbo (por ejemplo "sueldo 800 mil").
const INCOME_HINTS = /\b(sueldo|salario|aguinaldo|haberes|honorarios|changa|freelance)\b/;

const INCOME_TYPES = [
  { type: 'SUELDO', pattern: /\b(sueldo|salario|aguinaldo|haberes|recibo de sueldo)\b/ },
  { type: 'EXTRA', pattern: /\b(trabajo|trabajito|changa|changas|freelance|extra|extras|proyecto|cliente|honorarios|horas extra)\b/ },
];

const INCOME_LABELS = [
  [/\baguinaldo\b/, 'Aguinaldo'],
  [/\b(sueldo|salario|haberes)\b/, 'Sueldo'],
  [/\bfreelance\b/, 'Freelance'],
  [/\bchangas?\b/, 'Changa'],
  [/\bhonorarios\b/, 'Honorarios'],
  [/\bhoras extra\b/, 'Horas extra'],
  [/\b(trabajo|trabajito)\b/, 'Trabajo'],
  [/\bproyecto\b/, 'Proyecto'],
];

const INCOME_IGNORED = new Set(['cobre', 'cobramos', 'cobro', 'pagaron', 'depositaron', 'transfirieron', 'ingreso',
  'ingresaron', 'entro', 'entraron', 'recibi', 'recibimos', 'gane', 'ganamos', 'liquidaron', 'voy', 'vamos', 'van',
  'cobrar', 'pagar', 'depositar', 'tienen', 'tengo', 'espero', 'nos', 'por']);

/** 'INCOME', 'EXPENSE' o null si no está claro. */
export function detectKind(text) {
  const income = INCOME_VERBS.test(text);
  const expense = EXPENSE_VERBS.test(text);
  if (income && !expense) return 'INCOME';
  if (expense && !income) return 'EXPENSE';
  if (income && expense) return null; // "cobré y gasté…": que elija la persona
  if (INCOME_HINTS.test(text)) return 'INCOME';
  return null;
}

/**
 * @param {string} transcript Frase reconocida por voz (o escrita).
 * @param {string} today Fecha de hoy "AAAA-MM-DD" en Argentina (parámetro para poder testear).
 * @returns {{ kind: 'INCOME'|'EXPENSE'|null, amount: number|null, date: string, transcript: string,
 *             expense: { description: string, category: string, paymentMethod: string|null },
 *             income: { description: string, type: string, status: string } }}
 */
export function parseMovement(transcript, today = todayISO()) {
  const base = parseExpense(transcript, today);
  const text = wordsToDigits(clean(strip(base.transcript)));
  let kind = detectKind(text);
  // Sin verbo pero con una categoría de gasto reconocida ("12 mil de nafta"): es un egreso.
  if (kind === null && !INCOME_VERBS.test(text) && base.category !== 'OTROS') kind = 'EXPENSE';

  const incomeType = INCOME_TYPES.find((t) => t.pattern.test(text))?.type ?? 'OTROS';
  const incomeLabel = INCOME_LABELS.find(([re]) => re.test(text))?.[1]
    ?? fallbackDescription(base.transcript, INCOME_IGNORED)
    ?? 'Ingreso';
  const expected = FUTURE_INCOME.test(text) || base.date > today;

  return {
    kind,
    amount: base.amount,
    date: base.date,
    transcript: base.transcript,
    expense: { description: base.description, category: base.category, paymentMethod: base.paymentMethod },
    income: { description: incomeLabel, type: incomeType, status: expected ? 'EXPECTED' : 'RECEIVED' },
  };
}
