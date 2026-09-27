import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpense, wordsToDigits } from '../js/voice/expense-parser.js';
import { parseAmountInput, formatMoney } from '../js/format.js';

const TODAY = '2026-09-26'; // sábado
const parse = (text) => parseExpense(text, TODAY);

test('ejemplos del enunciado', () => {
  assert.deepEqual(parse('Gasté 18 mil pesos en una cena ayer.'), {
    amount: 18000, description: 'Cena', category: 'COMIDA', date: '2026-09-25',
    paymentMethod: null, transcript: 'Gasté 18 mil pesos en una cena ayer.',
  });

  let r = parse('Gasté 4500 en nafta.');
  assert.equal(r.amount, 4500);
  assert.equal(r.category, 'TRANSPORTE');
  assert.equal(r.description, 'Nafta');
  assert.equal(r.date, TODAY);

  r = parse('Pagué 10 lucas de estacionamiento');
  assert.equal(r.amount, 10000);
  assert.equal(r.category, 'TRANSPORTE');
  assert.equal(r.description, 'Estacionamiento');

  r = parse('Compré una remera por 35.500');
  assert.equal(r.amount, 35500);
  assert.equal(r.category, 'ROPA');
  assert.equal(r.description, 'Remera');

  r = parse('Me cobraron 8 mil de Spotify');
  assert.equal(r.amount, 8000);
  assert.equal(r.category, 'SUSCRIPCIONES');
  assert.equal(r.description, 'Spotify');

  r = parse('Gasté 23 lucas hoy en comida');
  assert.equal(r.amount, 23000);
  assert.equal(r.category, 'COMIDA');
  assert.equal(r.date, TODAY);
});

test('formas de decir montos', () => {
  const amount = (text) => parse(text).amount;
  assert.equal(amount('18 mil'), 18000);
  assert.equal(amount('18 lucas'), 18000);
  assert.equal(amount('18k en uber'), 18000);
  assert.equal(amount('4500'), 4500);
  assert.equal(amount('4.500'), 4500);
  assert.equal(amount('35.500'), 35500);
  assert.equal(amount('35 mil 500 en el super'), 35500);
  assert.equal(amount('$1.250.000 en una notebook'), 1250000);
  assert.equal(amount('12,50 de propina'), 12.5);
  assert.equal(amount('1,5 lucas'), 1500);
  assert.equal(amount('una luca de café'), 1000);
  assert.equal(amount('dieciocho mil pesos en una cena'), 18000);
  assert.equal(amount('dos mil quinientos en el kiosco'), 2500);
  assert.equal(amount('treinta y cinco mil de ropa'), 35000);
  assert.equal(amount('18 mil quinientos'), 18500);
  assert.equal(amount('compré 2 empanadas por 3000'), 3000);
  assert.equal(amount('gasté algo en el kiosco'), null);
});

test('fechas', () => {
  assert.equal(parse('hoy gasté 100').date, '2026-09-26');
  assert.equal(parse('ayer gasté 100').date, '2026-09-25');
  assert.equal(parse('anoche 5 mil de pizza').date, '2026-09-25');
  assert.equal(parse('anteayer gasté 100').date, '2026-09-24');
  assert.equal(parse('el lunes gasté 1500 en el colectivo').date, '2026-09-21');
  assert.equal(parse('el sábado pasado 2000 de cine').date, '2026-09-19');
  assert.equal(parse('sin fecha 100').date, TODAY);

  const r = parse('el 15 de septiembre pagué 20 mil de alquiler');
  assert.equal(r.date, '2026-09-15');
  assert.equal(r.amount, 20000);
  assert.equal(r.category, 'HOGAR');

  // Una fecha que todavía no llegó este año corresponde al año pasado
  assert.equal(parse('el 3 de diciembre 500').date, '2025-12-03');
});

test('categoría, forma de pago y descripción', () => {
  const r = parse('anteayer gasté 5000 en farmacia con mercado pago');
  assert.equal(r.category, 'SALUD');
  assert.equal(r.paymentMethod, 'MERCADO_PAGO');
  assert.equal(r.description, 'Farmacia');

  assert.equal(parse('3000 de birra con débito').paymentMethod, 'DEBITO');
  assert.equal(parse('3000 de birra').category, 'SALIDAS');
  assert.equal(parse('2 mil en el chino').description, 'Supermercado');
  // Gana la palabra que aparece primero
  assert.equal(parse('cena con amigos en un bar 20 mil').category, 'COMIDA');
  // "gas" no debe confundirse con "gasté"
  assert.equal(parse('gasté 100 en algo').category, 'OTROS');

  const other = parse('12,50 de propina');
  assert.equal(other.category, 'OTROS');
  assert.equal(other.description, 'Propina');
  assert.equal(parse('500').description, 'Gasto');
});

test('números con palabras', () => {
  assert.equal(wordsToDigits('gaste dieciocho mil'), 'gaste 18000');
  assert.equal(wordsToDigits('compre una remera'), 'compre una remera');
  assert.equal(wordsToDigits('una luca'), '1 luca');
  assert.equal(wordsToDigits('un millon doscientos mil'), '1200000');
});

test('importe escrito a mano en el formulario', () => {
  assert.equal(parseAmountInput('18.000'), 18000);
  assert.equal(parseAmountInput('18000'), 18000);
  assert.equal(parseAmountInput('12,50'), 12.5);
  assert.equal(parseAmountInput('$ 1.250.000'), 1250000);
  assert.ok(Number.isNaN(parseAmountInput('abc')));
  assert.ok(Number.isNaN(parseAmountInput('')));
  assert.equal(formatMoney(327450), '$327.450');
  assert.equal(formatMoney(-12500), '-$12.500');
  assert.equal(formatMoney(12.5), '$12,50');
});
