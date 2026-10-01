// Pantalla Plan (#/plan): resumen del mes, presupuesto por categoría y gastos fijos del mes.
import { api } from '../api.js';
import { getCategory } from '../categories.js';
import { addMonths, monthOf, todayISO } from '../dates.js';
import { formatDate, formatMoney, formatMonth } from '../format.js';
import { categoryBubble, errorState, escapeHtml, icon, loadingState, monthNav, topBar } from '../ui.js';

// Se conserva al ir a editar el presupuesto o pagar un gasto fijo y volver.
export const planView = { month: monthOf(todayISO()) };
const MAX_MONTHS_AHEAD = 12;

export function renderPlan(root) {
  root.innerHTML = `
    ${topBar('Plan del mes')}
    <section class="card month-card" data-slot="nav"></section>
    <div data-slot="content">${loadingState()}</div>`;

  const nav = root.querySelector('[data-slot="nav"]');
  const content = root.querySelector('[data-slot="content"]');

  const load = async () => {
    const limit = addMonths(monthOf(todayISO()), MAX_MONTHS_AHEAD);
    nav.innerHTML = monthNav(formatMonth(planView.month), { nextDisabled: planView.month >= limit });
    content.innerHTML = loadingState();
    try {
      const [budget, obligations] = await Promise.all([
        api.getBudget(planView.month),
        api.listObligations(planView.month),
      ]);
      content.innerHTML = summaryCard(budget.summary)
        + warnings(budget)
        + budgetCard(budget)
        + obligationsCard(obligations);
    } catch (error) {
      content.innerHTML = errorState(error.message);
    }
  };

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'retry') load();
    if (target.dataset.action === 'prev-month' || target.dataset.action === 'next-month') {
      planView.month = addMonths(planView.month, target.dataset.action === 'prev-month' ? -1 : 1);
      load();
    }
  });

  load();
}

// ---------- Resumen ----------

function summaryCard(s) {
  const row = (label, value, { strong = false, sign = false, note = '' } = {}) => {
    const n = Number(value);
    return `
      <li class="summary-row ${strong ? 'summary-row--total' : ''}">
        <span>${label}${note ? `<small>${note}</small>` : ''}</span>
        <span class="amount ${strong && n < 0 ? 'is-negative' : ''}">${sign && n > 0 ? '+' : ''}${formatMoney(n)}</span>
      </li>`;
  };
  return `
    <section class="card" aria-labelledby="summary-title">
      <h2 id="summary-title" class="card__title">${icon('wallet')}Resumen del mes</h2>
      <ul class="summary-list">
        ${row('Ingresos recibidos', s.incomeReceived)}
        ${row('Gastos reales', -s.expenses)}
        ${row('Balance registrado del mes', s.registeredBalance, { strong: true, sign: true })}
        ${row('Gastos fijos pendientes', -s.pendingRecurring)}
        ${row('Balance después de pendientes', s.balanceAfterPending, { strong: true, sign: true })}
      </ul>
      <p class="muted small">Estos balances muestran lo registrado en el mes. No son el saldo de tu cuenta.</p>

      <h3 class="summary-subtitle">Planificación</h3>
      <ul class="summary-list">
        ${row('Ingresos esperados pendientes', s.incomeExpectedPending)}
        ${row('Ingresos planificados', s.plannedIncome, { note: 'recibidos + esperados' })}
        ${row('Presupuesto total asignado', -s.budgetTotal)}
        ${row('Ingresos planificados sin asignar', s.unassignedPlannedIncome, { strong: true })}
      </ul>
    </section>`;
}

function warnings(budget) {
  const exceeded = budget.categories.filter((c) => c.exceeded);
  const items = [];
  if (exceeded.length) {
    items.push(`<strong>${exceeded.length === 1 ? 'Una categoría excede' : `${exceeded.length} categorías exceden`} su presupuesto:</strong>
      ${exceeded.map((c) => `${getCategory(c.category).label} (${formatMoney(c.remaining)})`).join(', ')}.`);
  }
  if (budget.overPlanned) {
    items.push(`El presupuesto total (${formatMoney(budget.summary.budgetTotal)}) supera tus ingresos planificados
      (${formatMoney(budget.summary.plannedIncome)}). Podés guardarlo igual, pero revisalo.`);
  }
  return items.map((text) => `<p class="notice notice--warn" role="status">${icon('alert')}<span>${text}</span></p>`).join('');
}

// ---------- Presupuesto ----------

function budgetCard(budget) {
  const editHref = `#/presupuesto/${planView.month}`;
  if (!budget.hasBudget) {
    const unbudgeted = budget.categories.filter((c) => Number(c.spent) > 0 || Number(c.pendingRecurring) > 0);
    return `
      <section class="card">
        <h2 class="card__title">${icon('target')}Presupuesto por categoría</h2>
        <p class="empty-text">Todavía no armaste el presupuesto de ${formatMonth(planView.month).toLowerCase()}.</p>
        <p class="muted small">Asigná un importe a cada categoría para ver cuánto te queda. Es un plan: no registra gastos ni mueve dinero.</p>
        <a class="btn btn--primary btn--block" href="${editHref}">${icon('plus-circle')}Armar presupuesto</a>
        ${unbudgeted.length ? categoryList(unbudgeted) : ''}
      </section>`;
  }
  const visible = budget.categories.filter((c) => c.assigned || Number(c.spent) > 0 || Number(c.pendingRecurring) > 0);
  return `
    <section class="card">
      <div class="card__head">
        <h2 class="card__title">${icon('target')}Presupuesto por categoría</h2>
        <a class="link" href="${editHref}">Editar${icon('chevron-right')}</a>
      </div>
      <p class="muted small">Restante = presupuesto − gastos reales − fijos pendientes.</p>
      ${categoryList(visible)}
    </section>`;
}

function categoryList(lines) {
  return `<ul class="budget-list">${lines.map(budgetLine).join('')}</ul>`;
}

function budgetLine(line) {
  const c = getCategory(line.category);
  const budget = Number(line.budget);
  const spent = Number(line.spent);
  const pending = Number(line.pendingRecurring);
  const remaining = Number(line.remaining);
  const base = Math.max(budget, spent + pending, 1);
  const pct = (value) => `${Math.min(100, (value / base) * 100).toFixed(1)}%`;

  return `
    <li class="budget-line ${line.exceeded ? 'budget-line--exceeded' : ''}">
      <div class="budget-line__head">
        <span class="budget-line__name">${c.emoji} ${c.label}</span>
        ${line.assigned
          ? `<span class="budget-line__remaining amount ${remaining < 0 ? 'is-negative' : ''}">${formatMoney(remaining)}<small>${remaining < 0 ? 'excedido' : 'restante'}</small></span>`
          : '<span class="tag">Sin presupuesto</span>'}
      </div>
      <div class="progress progress--stacked" aria-hidden="true">
        <span style="width:${pct(spent)};background:${c.color}"></span>
        <span class="progress__pending" style="width:${pct(pending)};--bar:${c.color}"></span>
      </div>
      <p class="budget-line__detail">
        ${line.assigned ? `Presupuesto ${formatMoney(budget)} · ` : ''}Gastado ${formatMoney(spent)}${pending > 0 ? ` · Fijos pendientes ${formatMoney(pending)}` : ''}
      </p>
      ${line.exceeded ? `<p class="budget-line__alert">${icon('alert')}Excede el presupuesto</p>` : ''}
    </li>`;
}

// ---------- Gastos fijos del mes ----------

const OBLIGATION_STATUS = {
  PENDING: { label: 'Pendiente', css: 'tag--pending' },
  PAID: { label: 'Pagado', css: 'tag--ok' },
  SKIPPED: { label: 'Omitido', css: '' },
};

function obligationsCard(obligations) {
  const pending = obligations.filter((o) => o.status === 'PENDING');
  return `
    <section class="card">
      <div class="card__head">
        <h2 class="card__title">${icon('repeat')}Gastos fijos del mes</h2>
        <a class="link" href="#/fijos">Gestionar${icon('chevron-right')}</a>
      </div>
      ${obligations.length === 0 ? `
        <p class="empty-text">No tenés gastos fijos en ${formatMonth(planView.month).toLowerCase()}.</p>
        <p class="muted small">Configurá una vez el alquiler, los servicios o las suscripciones y la app los prepara cada mes.</p>
        <a class="btn btn--outline btn--block" href="#/fijo/nuevo">${icon('plus-circle')}Nuevo gasto fijo</a>` : `
        <p class="muted small">${pending.length === 0 ? 'Todo al día este mes.' : `${pending.length} ${pending.length === 1 ? 'pendiente' : 'pendientes'} por ${formatMoney(pending.reduce((t, o) => t + Number(o.amount), 0))}.`}</p>
        <ul class="expense-list">${obligations.map(obligationRow).join('')}</ul>`}
    </section>`;
}

export function obligationRow(o) {
  const status = o.overdue ? { label: 'Vencido', css: 'tag--danger' } : OBLIGATION_STATUS[o.status];
  const amount = o.status === 'PAID' ? o.paidAmount : o.amount;
  return `
    <li>
      <a class="expense-row" href="#/obligacion/${o.id}">
        ${categoryBubble(o.category)}
        <span class="expense-row__main">
          <span class="expense-row__title">${escapeHtml(o.description)}</span>
          <span class="expense-row__sub">${o.status === 'PAID' ? `Pagado el ${formatDate(o.paidDate)}` : `Vence el ${formatDate(o.dueDate)}`}</span>
        </span>
        <span class="expense-row__end">
          <span class="amount ${o.status === 'SKIPPED' ? 'amount--muted' : ''}">${formatMoney(amount)}</span>
          <span class="tag ${status.css}">${status.label}</span>
        </span>
      </a>
    </li>`;
}
