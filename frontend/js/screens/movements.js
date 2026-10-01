// Pantalla Movimientos: gastos del mes agrupados por día, con búsqueda y filtro por categoría.
import { api } from '../api.js';
import { getCategory, getPaymentMethod } from '../categories.js';
import { addMonths, monthOf, monthRange, todayISO } from '../dates.js';
import { MONTHS, formatDate, formatMoney, formatMonth, formatRelativeDay, normalizeText } from '../format.js';
import { changeBadge, errorState, escapeHtml, expenseRow, icon, loadingState, movementTabs, topBar } from '../ui.js';

// Se conserva al volver de editar un gasto.
const view = { month: monthOf(todayISO()), search: '', category: 'ALL' };

export function renderMovements(root) {
  let expenses = [];

  root.innerHTML = `
    ${topBar('Movimientos')}
    ${movementTabs('gastos')}
    <div data-slot="header"></div>
    <label class="search">
      ${icon('search')}
      <span class="visually-hidden">Buscar movimientos</span>
      <input type="search" name="search" placeholder="Buscar por comercio, categoría o monto…"
             autocomplete="off" value="${escapeHtml(view.search)}">
    </label>
    <div class="chip-row" data-slot="filters" role="group" aria-label="Filtrar por categoría"></div>
    <div data-slot="list">${loadingState()}</div>`;

  const header = root.querySelector('[data-slot="header"]');
  const filters = root.querySelector('[data-slot="filters"]');
  const list = root.querySelector('[data-slot="list"]');

  const renderList = () => {
    const visible = expenses.filter((e) => matchesCategory(e) && matchesSearch(e, view.search));
    filters.innerHTML = filterChips(expenses);
    if (expenses.length === 0) {
      list.innerHTML = `<p class="empty-text">No hay gastos en ${formatMonth(view.month).toLowerCase()}.</p>`;
    } else if (visible.length === 0) {
      list.innerHTML = `<p class="empty-text">No hay resultados para esa búsqueda.</p>`;
    } else {
      list.innerHTML = groupByDay(visible) + `
        <p class="all-good">${icon('check-circle')}¡Al día! Todo ordenado y registrado.</p>`;
    }
  };

  const load = async () => {
    header.innerHTML = monthHeader(null);
    list.innerHTML = loadingState();
    const { from, to } = monthRange(view.month);
    try {
      const [items, dashboard] = await Promise.all([api.listExpenses(from, to), api.getDashboard(view.month)]);
      expenses = items;
      header.innerHTML = monthHeader(dashboard);
      renderList();
    } catch (error) {
      list.innerHTML = errorState(error.message);
    }
  };

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'retry') load();
    if (action === 'prev-month' || action === 'next-month') {
      view.month = addMonths(view.month, action === 'prev-month' ? -1 : 1);
      view.category = 'ALL';
      load();
    }
    if (action === 'filter') {
      view.category = target.dataset.category;
      renderList();
    }
  });

  root.querySelector('input[name="search"]').addEventListener('input', (event) => {
    view.search = event.target.value;
    renderList();
  });

  load();
}

function monthHeader(dashboard) {
  const isCurrent = view.month === monthOf(todayISO());
  const previousName = MONTHS[Number(addMonths(view.month, -1).slice(5)) - 1];
  return `
    <section class="card month-card">
      <div class="month-card__nav">
        <button type="button" class="icon-button icon-button--soft" data-action="prev-month" aria-label="Mes anterior">${icon('chevron-left')}</button>
        <span class="pill pill--lg">${icon('calendar')}${formatMonth(view.month)}</span>
        <button type="button" class="icon-button icon-button--soft" data-action="next-month" aria-label="Mes siguiente" ${isCurrent ? 'disabled' : ''}>${icon('chevron-right')}</button>
      </div>
      <div class="month-card__body">
        <div>
          <p class="muted">Total de gastos</p>
          <p class="month-card__total amount">${dashboard ? formatMoney(dashboard.total) : '—'}</p>
        </div>
        ${dashboard?.changePercent != null ? `
          <div class="month-card__change">
            ${changeBadge(dashboard.changePercent)}
            <span class="muted small">vs. ${previousName}</span>
          </div>` : ''}
      </div>
    </section>`;
}

function matchesCategory(expense) {
  return view.category === 'ALL' || expense.category === view.category;
}

function matchesSearch(expense, search) {
  const q = normalizeText(search).trim();
  if (!q) return true;
  const text = normalizeText([
    expense.description,
    getCategory(expense.category).label,
    getPaymentMethod(expense.paymentMethod).label,
  ].join(' '));
  const digits = q.replace(/[^\d]/g, '');
  const amountDigits = String(Math.round(Number(expense.amount)));
  return text.includes(q) || (digits.length > 0 && amountDigits.includes(digits));
}

function filterChips(expenses) {
  const present = [...new Set(expenses.map((e) => e.category))];
  const chip = (key, label, count) => `
    <button type="button" class="chip ${view.category === key ? 'is-selected' : ''}"
            data-action="filter" data-category="${key}" aria-pressed="${view.category === key}">
      ${label}${count != null ? ` <span class="chip__count">${count}</span>` : ''}
    </button>`;
  return chip('ALL', 'Todos', expenses.length)
    + present.map((key) => chip(key, `${getCategory(key).emoji} ${getCategory(key).label}`)).join('');
}

function groupByDay(expenses) {
  const groups = new Map();
  for (const e of expenses) {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  }
  return [...groups.entries()].map(([date, items]) => {
    const total = items.reduce((sum, e) => sum + Number(e.amount), 0);
    const relative = formatRelativeDay(date, { withYear: true });
    const title = relative === 'Hoy' || relative === 'Ayer' ? `${relative} — ${formatDate(date)}` : relative;
    return `
      <section class="day-group">
        <h2 class="day-group__head">
          <span>${title}</span>
          <span class="day-group__total">Total: <strong class="amount">${formatMoney(total)}</strong></span>
        </h2>
        <ul class="expense-list">${items.map((e) => expenseRow(e, 'detailed')).join('')}</ul>
      </section>`;
  }).join('');
}
