// Movimientos: historial del mes con ingresos y egresos juntos, agrupados por día,
// con filtros (todos / ingresos / egresos / categoría) y búsqueda.
import { api } from '../api.js';
import { getCategory, getIncomeType, getPaymentMethod } from '../categories.js';
import { addMonths, monthOf, monthRange, todayISO } from '../dates.js';
import { formatDate, formatMoney, formatMonth, formatRelativeDay, formatTime, normalizeText } from '../format.js';
import { categoryBubble, confirmDialog, errorState, escapeHtml, icon, loadingState, monthNav, showToast, topBar } from '../ui.js';

// Se conserva al volver de editar un movimiento. filter: ALL | INCOME | EXPENSE | <categoría>
export const movementsView = { month: monthOf(todayISO()), search: '', filter: 'ALL' };
const MAX_MONTHS_AHEAD = 12;

export function renderMovements(root) {
  let items = [];

  root.innerHTML = `
    ${topBar('Movimientos')}
    <div data-slot="header"></div>
    <div class="movements-actions">
      <a class="btn btn--primary" href="#/agregar">${icon('plus-circle')}Agregar movimiento</a>
      <a class="btn btn--outline" href="#/graficos">${icon('bars')}Gráficos</a>
    </div>
    <label class="search">
      ${icon('search')}
      <span class="visually-hidden">Buscar movimientos</span>
      <input type="search" name="search" placeholder="Buscar por concepto, categoría o monto…"
             autocomplete="off" value="${escapeHtml(movementsView.search)}">
    </label>
    <div class="chip-row" data-slot="filters" role="group" aria-label="Filtrar movimientos"></div>
    <div data-slot="list">${loadingState()}</div>`;

  const header = root.querySelector('[data-slot="header"]');
  const filters = root.querySelector('[data-slot="filters"]');
  const list = root.querySelector('[data-slot="list"]');

  const renderList = () => {
    filters.innerHTML = filterChips(items);
    const visible = items.filter((m) => matchesFilter(m) && matchesSearch(m, movementsView.search));
    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-card">
          <p class="empty-text">No hay movimientos en ${formatMonth(movementsView.month).toLowerCase()}.</p>
          <p class="muted small">Tocá “Agregar movimiento” para cargar un ingreso o un egreso.</p>
        </div>`;
    } else if (visible.length === 0) {
      list.innerHTML = '<p class="empty-text">No hay resultados con ese filtro o búsqueda.</p>';
    } else {
      list.innerHTML = groupByDay(visible);
    }
  };

  const load = async () => {
    header.innerHTML = monthHeader(null);
    list.innerHTML = loadingState();
    const { from, to } = monthRange(movementsView.month);
    try {
      const [expenses, incomes] = await Promise.all([
        api.listExpenses(from, to),
        api.listIncomes(movementsView.month),
      ]);
      items = [
        ...expenses.map((e) => ({ ...e, kind: 'EXPENSE' })),
        ...incomes.map((i) => ({ ...i, kind: 'INCOME' })),
      ].sort((a, b) => (b.date.localeCompare(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      header.innerHTML = monthHeader(items);
      renderList();
    } catch (error) {
      list.innerHTML = errorState(error.message);
    }
  };

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'retry') load();
    if (action === 'prev-month' || action === 'next-month') {
      movementsView.month = addMonths(movementsView.month, action === 'prev-month' ? -1 : 1);
      load();
    }
    if (action === 'filter') {
      movementsView.filter = target.dataset.filter;
      renderList();
    }
    if (action === 'receive') {
      if (target.dataset.date > todayISO()) {
        const ok = await confirmDialog({
          title: '¿Ya lo cobraste?',
          message: `Se esperaba para el ${formatDate(target.dataset.date)}. Si lo marcás como recibido, queda cobrado hoy (${formatDate(todayISO())}) y pasa a contar en ${formatMonth(monthOf(todayISO())).toLowerCase()}.`,
          confirmLabel: 'Sí, lo cobré hoy',
        });
        if (!ok) return;
      }
      target.disabled = true;
      try {
        await api.receiveIncome(target.dataset.id);
        showToast('Ingreso marcado como recibido');
        load();
      } catch (error) {
        showToast(error.message);
        target.disabled = false;
      }
    }
  });

  root.querySelector('input[name="search"]').addEventListener('input', (event) => {
    movementsView.search = event.target.value;
    renderList();
  });

  load();
}

function monthHeader(items) {
  const sum = (predicate) => (items ?? []).filter(predicate).reduce((t, m) => t + Number(m.amount), 0);
  const received = sum((m) => m.kind === 'INCOME' && m.status === 'RECEIVED');
  const expected = sum((m) => m.kind === 'INCOME' && m.status === 'EXPECTED');
  const spent = sum((m) => m.kind === 'EXPENSE');
  const balance = received - spent;
  const limit = addMonths(monthOf(todayISO()), MAX_MONTHS_AHEAD);
  const value = (text) => (items ? text : '—');
  return `
    <section class="card month-card">
      ${monthNav(formatMonth(movementsView.month), { nextDisabled: movementsView.month >= limit })}
      <div class="totals-grid">
        <div><p class="muted small">Ingresos recibidos</p><p class="totals-grid__value amount amount--income">${value(`+${formatMoney(received)}`)}</p></div>
        <div><p class="muted small">Egresos</p><p class="totals-grid__value amount">${value(`−${formatMoney(spent)}`)}</p></div>
        <div><p class="muted small">Balance</p><p class="totals-grid__value amount ${balance < 0 ? 'is-negative' : ''}">${value(`${balance > 0 ? '+' : ''}${formatMoney(balance)}`)}</p></div>
      </div>
      ${expected > 0 ? `<p class="muted small">Además hay ${formatMoney(expected)} en ingresos esperados (todavía no cobrados, no suman al balance).</p>` : ''}
    </section>`;
}

function matchesFilter(m) {
  const f = movementsView.filter;
  if (f === 'ALL') return true;
  if (f === 'INCOME' || f === 'EXPENSE') return m.kind === f;
  return m.kind === 'EXPENSE' && m.category === f;
}

function matchesSearch(m, search) {
  const q = normalizeText(search).trim();
  if (!q) return true;
  const label = m.kind === 'EXPENSE'
    ? `${getCategory(m.category).label} ${getPaymentMethod(m.paymentMethod).label} egreso gasto`
    : `${getIncomeType(m.type).label} ingreso`;
  const text = normalizeText(`${m.description} ${label}`);
  const digits = q.replace(/[^\d]/g, '');
  return text.includes(q) || (digits.length > 0 && String(Math.round(Number(m.amount))).includes(digits));
}

function filterChips(items) {
  const categories = [...new Set(items.filter((m) => m.kind === 'EXPENSE').map((m) => m.category))];
  const count = (kind) => items.filter((m) => m.kind === kind).length;
  const chip = (key, label, n) => `
    <button type="button" class="chip ${movementsView.filter === key ? 'is-selected' : ''}"
            data-action="filter" data-filter="${key}" aria-pressed="${movementsView.filter === key}">
      ${label}${n != null ? ` <span class="chip__count">${n}</span>` : ''}
    </button>`;
  return chip('ALL', 'Todos', items.length)
    + chip('INCOME', '+ Ingresos', count('INCOME'))
    + chip('EXPENSE', '− Egresos', count('EXPENSE'))
    + categories.map((key) => chip(key, `${getCategory(key).emoji} ${getCategory(key).label}`)).join('');
}

function groupByDay(items) {
  const groups = new Map();
  for (const m of items) {
    if (!groups.has(m.date)) groups.set(m.date, []);
    groups.get(m.date).push(m);
  }
  return [...groups.entries()].map(([date, dayItems]) => {
    const relative = formatRelativeDay(date, { withYear: true });
    const title = relative === 'Hoy' || relative === 'Ayer' ? `${relative} — ${formatDate(date)}` : relative;
    return `
      <section class="day-group">
        <h2 class="day-group__head"><span>${title}</span></h2>
        <ul class="expense-list">${dayItems.map((m) => (m.kind === 'EXPENSE' ? expenseItem(m) : incomeItem(m))).join('')}</ul>
      </section>`;
  }).join('');
}

function expenseItem(e) {
  const c = getCategory(e.category);
  const payment = getPaymentMethod(e.paymentMethod);
  const time = formatTime(e.createdAt);
  return `
    <li>
      <a class="expense-row expense-row--detailed ${e.source === 'VOICE' ? 'expense-row--voice' : ''}" href="#/gasto/${e.id}">
        ${categoryBubble(e.category, 'category-bubble--lg')}
        <span class="expense-row__main">
          <span class="expense-row__title">${escapeHtml(e.description)}</span>
          <span class="expense-row__sub">${c.label} · ${payment.label}${time ? ` · ${time}` : ''}</span>
          <span class="tag-row">
            <span class="tag tag--expense">− Egreso</span>
            ${e.source === 'VOICE' ? `<span class="tag tag--voice">${icon('mic')}Voz</span>` : ''}
          </span>
        </span>
        <span class="amount amount--lg">−${formatMoney(e.amount)}</span>
      </a>
    </li>`;
}

function incomeItem(i) {
  const type = getIncomeType(i.type);
  const received = i.status === 'RECEIVED';
  return `
    <li class="row-with-action">
      <a class="expense-row expense-row--detailed" href="#/ingreso/${i.id}">
        <span class="category-bubble category-bubble--lg" style="--cat-bg:#d1fae5" aria-hidden="true">${type.emoji}</span>
        <span class="expense-row__main">
          <span class="expense-row__title">${escapeHtml(i.description)}</span>
          <span class="expense-row__sub">${type.label}${received ? '' : ' · todavía no cobrado'}</span>
          <span class="tag-row">
            <span class="tag tag--income">+ Ingreso</span>
            <span class="tag ${received ? 'tag--ok' : 'tag--pending'}">${received ? 'Recibido' : 'Esperado'}</span>
          </span>
        </span>
        <span class="amount amount--lg ${received ? 'amount--income' : 'amount--muted'}">+${formatMoney(i.amount)}</span>
      </a>
      ${received ? '' : `
        <button type="button" class="btn btn--small btn--ghost row-with-action__button" data-action="receive" data-id="${i.id}" data-date="${i.date}">
          ${icon('check-circle')}Marcar como recibido</button>`}
    </li>`;
}
