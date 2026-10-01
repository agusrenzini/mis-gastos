import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMovement } from '../js/voice/movement-parser.js';

const TODAY = '2026-10-01';
const parse = (text) => parseMovement(text, TODAY);

test('los cuatro ejemplos pedidos', () => {
  let r = parse('Cobré 800 mil de sueldo');
  assert.equal(r.kind, 'INCOME');
  assert.equal(r.amount, 800000);
  assert.equal(r.income.type, 'SUELDO');
  assert.equal(r.income.status, 'RECEIVED');
  assert.equal(r.income.description, 'Sueldo');
  assert.equal(r.date, TODAY);

  r = parse('Me ingresaron 25 mil por un trabajo');
  assert.equal(r.kind, 'INCOME');
  assert.equal(r.amount, 25000);
  assert.equal(r.income.type, 'EXTRA');
  assert.equal(r.income.status, 'RECEIVED');
  assert.equal(r.income.description, 'Trabajo');

  r = parse('Gasté 12 mil en supermercado');
  assert.equal(r.kind, 'EXPENSE');
  assert.equal(r.amount, 12000);
  assert.equal(r.expense.category, 'COMIDA');
  assert.equal(r.expense.description, 'Supermercado');
  assert.equal(r.date, TODAY);

  r = parse('Pagué 8 mil de internet');
  assert.equal(r.kind, 'EXPENSE');
  assert.equal(r.amount, 8000);
  assert.equal(r.expense.category, 'HOGAR');
  assert.equal(r.expense.description, 'Internet');
});

test('importes habituales en español argentino', () => {
  assert.equal(parse('cobré mil pesos').amount, 1000);
  assert.equal(parse('cobré 800 mil').amount, 800000);
  assert.equal(parse('gasté 12.500 en la farmacia').amount, 12500);
  assert.equal(parse('me pagaron 35 lucas').amount, 35000);
  assert.equal(parse('cobré un millón doscientos mil de sueldo').amount, 1200000);
  assert.equal(parse('cobré ochocientos mil de sueldo').amount, 800000);
});

test('"me cobraron" es un egreso, "cobré" es un ingreso', () => {
  assert.equal(parse('Me cobraron 8 mil de Spotify').kind, 'EXPENSE');
  assert.equal(parse('El taxi me cobró 5 mil').kind, 'EXPENSE');
  assert.equal(parse('Cobré 8 mil').kind, 'INCOME');
  assert.equal(parse('Me pagaron 50 mil').kind, 'INCOME');
  assert.equal(parse('Pagué 50 mil').kind, 'EXPENSE');
  assert.equal(parse('Me depositaron el aguinaldo, 400 mil').income.description, 'Aguinaldo');
});

test('si no está claro, no se elige solo', () => {
  assert.equal(parse('50 mil').kind, null);
  assert.equal(parse('ayer 3000').kind, null);
  assert.equal(parse('cobré 10 mil y gasté 5 mil').kind, null);
  // Sin verbo pero con una categoría de gasto reconocida: egreso
  assert.equal(parse('12 mil de nafta').kind, 'EXPENSE');
  // Sin verbo pero con "sueldo": ingreso
  assert.equal(parse('sueldo 900 mil').kind, 'INCOME');
});

test('falta el importe: queda vacío para completarlo', () => {
  const r = parse('cobré el sueldo');
  assert.equal(r.kind, 'INCOME');
  assert.equal(r.amount, null);
});

test('fecha: hoy por defecto, o la mencionada', () => {
  assert.equal(parse('Cobré 10 mil').date, TODAY);
  assert.equal(parse('Ayer me pagaron 10 mil').date, '2026-09-30');
  assert.equal(parse('gasté 5 mil el 28 de septiembre').date, '2026-09-28');
});

test('ingreso a futuro queda como esperado', () => {
  assert.equal(parse('Voy a cobrar 800 mil de sueldo').income.status, 'EXPECTED');
  assert.equal(parse('Me van a pagar 20 mil por un trabajo').income.type, 'EXTRA');
});
