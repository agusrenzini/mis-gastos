// Movimientos → Ingresos (#/ingresos): ingresos del mes, recibidos y esperados.
import { api } from '../api.js';
import { getIncomeType } from '../categories.js';
import { addMonths, monthOf, todayISO } from '../dates.js';
import { formatDate, formatMoney, formatMonth } from '../format.js';
import { errorState, escapeHtml, icon, loadingState, monthNav, movementTabs, showToast, topBar } from '../ui.js';

// Se conserva al volver de editar un ingreso.
const view = { month: monthOf(todayISO()) };
const MAX_MONTHS_AHEAD = 12;

export function renderIncomes(root) {
  root.innerHTML = `
    ${topBar('Movimientos')}
    ${movementTabs('ingresos')}
    <div data-slot="header"></div>
    <a class="btn btn--primary btn--block" href="#/ingreso/nuevo">${icon('plus-circle')}Nuevo ingreso</a>
    <div data-slot="list">${loadingState()}</div>`;

  const header = root.querySelector('[data-slot="header"]');
  const list = root.querySelector('[data-slot="list"]');

  const load = async () => {
    header.innerHTML = monthHeader(null);
    list.innerHTML = loadingState();
    try {
      const incomes = await api.listIncomes(view.month);
      header.innerHTML = monthHeader(incomes);
      list.innerHTML = incomeList(incomes);
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
      view.month = addMonths(view.month, action === 'prev-month' ? -1 : 1);
      load();
    }
    if (action === 'receive') {
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

  load();
}

function monthHeader(incomes) {
  const sum = (status) => (incomes ?? [])
    .filter((i) => i.status === status).reduce((total, i) => total + Number(i.amount), 0);
  const limit = addMonths(monthOf(todayISO()), MAX_MONTHS_AHEAD);
  return `
    <section class="card month-card">
      ${monthNav(formatMonth(view.month), { nextDisabled: view.month >= limit })}
      <div class="income-totals">
        <div>
          <p class="muted small">Recibidos</p>
          <p class="income-totals__value income-totals__value--ok amount">${incomes ? `+${formatMoney(sum('RECEIVED'))}` : '—'}</p>
        </div>
        <div>
          <p class="muted small">Esperados</p>
          <p class="income-totals__value amount">${incomes ? formatMoney(sum('EXPECTED')) : '—'}</p>
        </div>
      </div>
      <p class="muted small">Los esperados sirven para planificar; solo los recibidos cuentan como dinero ingresado.</p>
    </section>`;
}

function incomeList(incomes) {
  if (incomes.length === 0) {
    return `
      <div class="empty-card">
        <p class="empty-text">No hay ingresos en ${formatMonth(view.month).toLowerCase()}.</p>
        <p class="muted small">Cargá tu sueldo como <strong>esperado</strong> para planificar el mes, y marcalo como recibido cuando lo cobres.</p>
      </div>`;
  }
  return `<ul class="expense-list">${incomes.map(incomeRow).join('')}</ul>`;
}

function incomeRow(income) {
  const type = getIncomeType(income.type);
  const received = income.status === 'RECEIVED';
  return `
    <li class="row-with-action">
      <a class="expense-row expense-row--detailed" href="#/ingreso/${income.id}">
        <span class="category-bubble category-bubble--lg" style="--cat-bg:#d1fae5" aria-hidden="true">${type.emoji}</span>
        <span class="expense-row__main">
          <span class="expense-row__title">${escapeHtml(income.description)}</span>
          <span class="expense-row__sub">${type.label} · ${received ? 'cobrado' : 'esperado para'} el ${formatDate(income.date)}</span>
          <span class="tag ${received ? 'tag--ok' : 'tag--pending'}">${received ? 'Recibido' : 'Esperado'}</span>
        </span>
        <span class="amount amount--lg ${received ? 'amount--income' : 'amount--muted'}">${received ? '+' : ''}${formatMoney(income.amount)}</span>
      </a>
      ${received ? '' : `
        <button type="button" class="btn btn--small btn--ghost row-with-action__button" data-action="receive" data-id="${income.id}">
          ${icon('check-circle')}Marcar como recibido</button>`}
    </li>`;
}
