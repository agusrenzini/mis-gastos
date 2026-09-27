// Interpreta una frase como "Gasté 18 lucas en una cena ayer" y devuelve
// { amount, description, category, date, paymentMethod, transcript }.
//
// Funciona con reglas simples (sin IA) y no depende del navegador: se puede testear con Node.
// Si en el futuro se usa un modelo de IA, alcanza con reemplazar parseExpense()
// por otra función que devuelva el mismo objeto.

import { addDays, parseISODate, toISODate, todayISO, weekdayOf } from '../dates.js';

// ---------- Palabras clave por categoría ----------
// "texto que se busca|Descripción sugerida". Sin "|", la descripción es la palabra con mayúscula.
const CATEGORY_KEYWORDS = {
  COMIDA: ['comida', 'almuerzo', 'almorcé|Almuerzo', 'cena', 'cené|Cena', 'desayuno', 'desayuné|Desayuno',
    'merienda', 'pizza', 'empanada', 'empanadas', 'hamburguesa', 'sushi', 'helado', 'café', 'cafetería',
    'restaurante', 'restaurant|Restaurante', 'resto|Restaurante', 'delivery', 'pedidosya|PedidosYa',
    'pedidos ya|PedidosYa', 'rappi|Rappi', 'super|Supermercado', 'supermercado', 'chino|Supermercado',
    'verdulería', 'carnicería', 'panadería', 'facturas', 'almacén', 'kiosco', 'kiosko|Kiosco',
    'milanesa', 'asado', 'lomito', 'mcdonalds|McDonald\'s', 'mc donalds|McDonald\'s', 'burger king|Burger King',
    'fruta', 'medialunas'],
  TRANSPORTE: ['nafta', 'combustible', 'gasoil', 'gnc|GNC', 'ypf|Nafta', 'uber|Uber', 'cabify|Cabify',
    'didi|DiDi', 'taxi', 'remis', 'colectivo', 'bondi|Colectivo', 'sube|SUBE', 'subte', 'tren',
    'estacionamiento', 'peaje', 'micro', 'pasaje', 'mecánico'],
  ENTRETENIMIENTO: ['cine', 'teatro', 'recital', 'concierto', 'show', 'entradas', 'entrada|Entradas', 'museo',
    'videojuego', 'juego', 'steam|Steam', 'playstation|PlayStation', 'bowling'],
  ROPA: ['ropa', 'remera', 'pantalón', 'zapatillas', 'zapatos', 'campera', 'buzo', 'jean', 'vestido', 'camisa',
    'medias', 'pollera', 'malla', 'peluquería', 'corte de pelo', 'barbería', 'perfume', 'maquillaje'],
  PAREJA: ['pareja', 'novia|Pareja', 'novio|Pareja', 'regalo', 'flores', 'aniversario', 'cita'],
  SALIDAS: ['salida', 'bar', 'birra|Cerveza', 'birras|Cerveza', 'cerveza', 'cervezas|Cerveza', 'boliche',
    'tragos', 'trago|Tragos', 'fernet', 'previa', 'cervecería'],
  FACULTAD: ['facultad', 'facu|Facultad', 'fotocopias', 'apuntes', 'apunte|Apuntes', 'libro', 'libros',
    'universidad', 'curso', 'materia', 'útiles', 'cuaderno'],
  TECNOLOGIA: ['celular', 'auriculares', 'computadora', 'notebook', 'cargador', 'mouse', 'teclado', 'cable',
    'monitor', 'tablet', 'funda', 'pendrive', 'tecnología'],
  HOGAR: ['alquiler', 'expensas', 'luz', 'gas', 'internet', 'wifi|Internet', 'limpieza', 'muebles',
    'ferretería', 'lavandería', 'edenor|Luz', 'edesur|Luz', 'metrogas|Gas', 'abl|ABL', 'hogar'],
  SALUD: ['farmacia', 'remedio', 'remedios', 'medicamento', 'médico', 'dentista', 'odontólogo', 'psicólogo',
    'psicóloga', 'prepaga', 'obra social', 'análisis', 'kinesiólogo', 'gimnasio', 'gym|Gimnasio', 'vacuna',
    'consulta'],
  SUSCRIPCIONES: ['spotify|Spotify', 'netflix|Netflix', 'disney|Disney+', 'hbo|HBO Max', 'youtube|YouTube Premium',
    'amazon prime|Amazon Prime', 'prime video|Prime Video', 'chatgpt|ChatGPT', 'icloud|iCloud',
    'apple music|Apple Music', 'paramount|Paramount+', 'crunchyroll|Crunchyroll', 'google one|Google One',
    'suscripción'],
};

const PAYMENT_KEYWORDS = [
  ['MERCADO_PAGO', /\b(mercado ?pago|mp)\b/],
  ['CREDITO', /\b(credito|en cuotas|cuotas)\b/],
  ['DEBITO', /\bdebito\b/],
  ['EFECTIVO', /\b(efectivo|cash)\b/],
  ['TRANSFERENCIA', /\b(transferencia|transferi)\b/],
];

// ---------- Números escritos con palabras ----------
const NUMBER_WORDS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};
const BIG_WORDS = { mil: 1000, millon: 1_000_000, millones: 1_000_000 };
const ARTICLES = new Set(['un', 'una', 'uno']);
const MULTIPLIER_AFTER_ARTICLE = new Set(['mil', 'luca', 'lucas', 'millon']);

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/** Minúsculas y sin tildes: "Gasté" → "gaste". */
function strip(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Saca signos de puntuación, pero respeta los puntos y comas dentro de números ("18.000", "12,50"). */
function clean(text) {
  return text
    .replace(/[¿?¡!;:"“”«»()]/g, ' ')
    .replace(/(?<!\d)[.,]|[.,](?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsValue(words) {
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w in BIG_WORDS) {
      current = (current || 1) * BIG_WORDS[w];
      total += current;
      current = 0;
    } else {
      current += NUMBER_WORDS[w];
    }
  }
  return total + current;
}

/** "dieciocho mil" → "18000" · "treinta y cinco lucas" → "35 lucas" · "18 mil quinientos" → "18 mil 500" */
export function wordsToDigits(text) {
  const tokens = text.split(' ').filter(Boolean);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const isArticle = ARTICLES.has(t);
    const starts = (t in NUMBER_WORDS && !isArticle)
      || (isArticle && MULTIPLIER_AFTER_ARTICLE.has(tokens[i + 1]))
      || t in BIG_WORDS;
    if (!starts) {
      out.push(t);
      i++;
      continue;
    }
    const seq = [];
    let j = i;
    while (j < tokens.length) {
      const w = tokens[j];
      if (w in NUMBER_WORDS || w in BIG_WORDS) {
        seq.push(w);
        j++;
      } else if (w === 'y' && seq.length && tokens[j + 1] in NUMBER_WORDS) {
        j++;
      } else {
        break;
      }
    }
    const previousIsNumber = out.length > 0 && /^\$?\d[\d.,]*$/.test(out[out.length - 1]);
    if (seq[0] in BIG_WORDS && previousIsNumber) {
      // "18 mil" ya está bien; solo convertimos lo que sigue ("18 mil quinientos" → "18 mil 500")
      out.push(seq[0]);
      if (seq.length > 1) out.push(String(wordsValue(seq.slice(1))));
    } else {
      out.push(String(wordsValue(seq)));
    }
    i = j;
  }
  return out.join(' ');
}

// ---------- Fecha ----------

function extractDate(text, today) {
  const monthRe = new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${MONTH_NAMES.join('|')}|setiembre)\\b`);
  const m = text.match(monthRe);
  if (m) {
    const day = Number(m[1]);
    const month = m[2] === 'setiembre' ? 8 : MONTH_NAMES.indexOf(m[2]);
    let year = parseISODate(today).getFullYear();
    let candidate = new Date(year, month, day);
    if (candidate.getMonth() === month) {
      if (toISODate(candidate) > today) candidate = new Date(--year, month, day);
      return { date: toISODate(candidate), text: text.replace(m[0], ' ') };
    }
  }

  const relative = [
    [/\b(anteayer|antes de ayer|antier)\b/, -2],
    [/\b(ayer|anoche)\b/, -1],
    [/\bhoy\b/, 0],
  ];
  for (const [re, offset] of relative) {
    const r = text.match(re);
    if (r) return { date: addDays(today, offset), text: text.replace(r[0], ' ') };
  }

  const weekdayRe = new RegExp(`\\b(?:el\\s+)?(${WEEKDAY_NAMES.join('|')})(\\s+pasado)?\\b`);
  const w = text.match(weekdayRe);
  if (w) {
    let back = (weekdayOf(today) - WEEKDAY_NAMES.indexOf(w[1]) + 7) % 7;
    if (back === 0 && w[2]) back = 7;
    return { date: addDays(today, -back), text: text.replace(w[0], ' ') };
  }

  return { date: today, text };
}

// ---------- Monto ----------

const AMOUNT_RE = new RegExp(
  '(\\$\\s*)?' +
  '(\\d{1,3}(?:\\.\\d{3})+|\\d{1,3}(?:,\\d{3})+(?!\\d)|\\d+)' + // 18000 · 18.000 · 18,000
  '(?:,(\\d{1,2}))?(?!\\d)' + // decimales: 12,50
  '(?:\\s*(millones|millon|mil|lucas|luca|k)(?![a-z])' + // 18 mil · 18 lucas · 18k
  '(?:\\s+(\\d{1,3})(?![\\d.,])(?!\\s*(?:mil|lucas|luca|k|millon|millones)(?![a-z])))?' + // 35 mil 500
  ')?' +
  '(\\s*(?:pesos|peso|mangos|ars)(?![a-z]))?',
  'g');

const MULTIPLIERS = { mil: 1000, luca: 1000, lucas: 1000, k: 1000, millon: 1_000_000, millones: 1_000_000 };

function extractAmount(text) {
  const candidates = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const [, currency, integerPart, decimals, multiplier, extra, suffix] = m;
    let value = Number(integerPart.replace(/[.,]/g, '') + (decimals ? `.${decimals}` : ''));
    if (multiplier) value = value * MULTIPLIERS[multiplier] + (extra ? Number(extra) : 0);
    if (!(value > 0)) continue;
    candidates.push({ value: Math.round(value * 100) / 100, money: Boolean(currency || multiplier || suffix) });
  }
  if (candidates.length === 0) return null;
  const withContext = candidates.find((c) => c.money);
  if (withContext) return withContext.value;
  return Math.max(...candidates.map((c) => c.value));
}

// ---------- Categoría y descripción ----------

const KEYWORD_INDEX = Object.entries(CATEGORY_KEYWORDS).flatMap(([category, words]) =>
  words.map((entry) => {
    const [word, label] = entry.split('|');
    return {
      category,
      pattern: new RegExp(`(?:^|[^a-z0-9])${strip(word)}(?![a-z0-9])`),
      length: word.length,
      label: label ?? word.charAt(0).toUpperCase() + word.slice(1),
    };
  }));

function detectCategory(text) {
  let best = null;
  for (const keyword of KEYWORD_INDEX) {
    const m = keyword.pattern.exec(text);
    if (!m) continue;
    const position = m.index;
    if (!best || position < best.position || (position === best.position && keyword.length > best.length)) {
      best = { ...keyword, position };
    }
  }
  return best;
}

const IGNORED_WORDS = new Set(['gaste', 'gastamos', 'gasto', 'pague', 'pagamos', 'compre', 'compramos',
  'me', 'cobraron', 'salio', 'salieron', 'costo', 'fue', 'fueron', 'puse', 'cargue', 'hoy', 'ayer',
  'anteayer', 'anoche', 'pesos', 'peso', 'mangos', 'lucas', 'luca', 'mil', 'k', 'con', 'tarjeta',
  'efectivo', 'debito', 'credito', 'mercado', 'pago', 'transferencia']);
const EDGE_WORDS = new Set(['en', 'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'unos', 'unas', 'por',
  'para', 'con', 'y', 'a', 'al', 'que', 'mi', 'mis']);

/** Si no hubo palabra clave, arma la descripción con lo que queda de la frase. */
function fallbackDescription(original) {
  const words = clean(original).split(' ').filter((word) => {
    const w = strip(word).replace(/^\$/, '');
    return w && !IGNORED_WORDS.has(w) && !(w in NUMBER_WORDS) && !/\d/.test(w);
  });
  while (words.length && EDGE_WORDS.has(strip(words[0]))) words.shift();
  while (words.length && EDGE_WORDS.has(strip(words[words.length - 1]))) words.pop();
  const text = words.join(' ').slice(0, 60).trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}

// ---------- API pública ----------

/**
 * @param {string} transcript Frase reconocida por voz (o escrita).
 * @param {string} today Fecha de hoy "AAAA-MM-DD" (parámetro para poder testear).
 */
export function parseExpense(transcript, today = todayISO()) {
  const original = String(transcript ?? '').trim();
  const text = wordsToDigits(clean(strip(original)));

  const { date, text: withoutDate } = extractDate(text, today);
  const withoutTimes = withoutDate.replace(/\ba las \d{1,2}(?:[:.]\d{2})?\b|\b\d{1,2}:\d{2}\b/g, ' ');
  const keyword = detectCategory(text);
  const payment = PAYMENT_KEYWORDS.find(([, re]) => re.test(text));

  return {
    amount: extractAmount(withoutTimes),
    description: keyword?.label ?? fallbackDescription(original) ?? 'Gasto',
    category: keyword?.category ?? 'OTROS',
    date,
    paymentMethod: payment ? payment[0] : null,
    transcript: original,
  };
}
