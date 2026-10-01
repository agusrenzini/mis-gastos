// Plan (#/plan): organizar un mes, por defecto el próximo.
// En una sola pantalla: ingresos del mes (esperados y recibidos), cuánto falta asignar,
// presupuesto por categoría, gastos fijos del mes y lo registrado hasta ahora.
// Presupuestar no crea gastos reales; lo esperado no se muestra como dinero disponible.
import { api } from '../api.js';
import { getCategory, getIncomeType } from '../categories.js';
import { addMonths, monthOf, todayISO } from '../dates.js';
import { formatDate, formatMoney, formatMonth } from '../format.js';
import { categoryBubble, confirmDialog, errorState, escapeHtml, icon, loadingState, monthNav, showToast, topBar } from '../ui.js';

// La primera vez muestra el próximo mes; después recuerda el que se eligió.
export const planView = { month: addMonths(monthOf(todayISO()), 1) };
const MAX_MONTHS_AHEAD = 12;

export function renderPlan(root) {
  root.innerHTML = `
    ${topBar('Plan')}
    <section class="card month-card" data-slot="nav"></section>
    <div data-slot="content">${loadingState()}</div>`;

  const nav = root.querySelector('[data-slot="nav"]');
  const content = root.querySelector('[data-slot="content"]');

  const load = async () => {
    const current = monthOf(todayISO());
    const limit = addMonths(current, MAX_MONTHS_AHEAD);
    const label = planView.month === current ? `${formatMonth(planView.month)} (actual)`
      : planView.month === addMonths(current, 1) ? `${formatMonth(planView.month)} (próximo)` : formatMonth(planView.month);
    nav.innerHTML = monthNav(label, { nextDisabled: planView.month >= limit });
    content.innerHTML = loadingState();
    try {
      const [budget, obligations, incomes] = await Promise.all([
        api.getBudget(planView.month),
        api.listObligations(planView.month),
        api.listIncomes(planView.month),
      ]);
      content.innerHTML = incomesCard(incomes, budget.summary)
        + allocationCard(budget)
        + warnings(budget)
        + budgetCard(budget)
        + obligationsCard(obligations)
        + recordedCard(budget.summary);
    } catch (error) {
      content.innerHTML = errorState(error.message);
    }
  };

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'retry') load();
    if (action === 'prev-month' || action === 'next-month') {
      planView.month = addMonths(planView.month, action === 'prev-month' ? -1 : 1);
      load();
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

  load();
}

// ---------- Ingresos del mes ----------

function incomesCard(incomes, s) {
  return `
    <section class="card" aria-labelledby="plan-incomes">
      <h2 id="plan-incomes" class="card__title">${icon('income')}Ingresos del mes</h2>
      <div class="totals-grid totals-grid--2">
        <div><p class="muted small">Recibidos</p><p class="totals-grid__value amount amount--income">+${formatMoney(s.incomeReceived)}</p></div>
        <div><p class="muted small">Esperados (sin cobrar)</p><p class="totals-grid__value amount amount--muted">${formatMoney(s.incomeExpectedPending)}</p></div>
      </div>
      <p class="muted small">Lo esperado sirve para planificar, pero todavía no es dinero disponible.</p>
      ${incomes.length ? `<ul class="expense-list plan-incomes">${incomes.map(incomeRow).join('')}</ul>`
        : '<p class="empty-text">Todavía no cargaste ingresos para este mes.</p>'}
      <a class="btn btn--outline btn--block" href="#/ingreso/esperado/${planView.month}">${icon('plus-circle')}Agregar ingreso esperado</a>
    </section>`;
}

function incomeRow(i) {
  const type = getIncomeType(i.type);
  const received = i.status === 'RECEIVED';
  return `
    <li class="row-with-action">
      <a class="expense-row" href="#/ingreso/${i.id}">
        <span class="category-bubble" style="--cat-bg:#d1fae5" aria-hidden="true">${type.emoji}</span>
        <span class="expense-row__main">
          <span class="expense-row__title">${escapeHtml(i.description)}</span>
          <span class="expense-row__sub">${received ? 'Cobrado' : 'Se espera'} el ${formatDate(i.date)}</span>
        </span>
        <span class="expense-row__end">
          <span class="amount ${received ? 'amount--income' : 'amount--muted'}">+${formatMoney(i.amount)}</span>
          <span class="tag ${received ? 'tag--ok' : 'tag--pending'}">${received ? 'Recibido' : 'Esperado'}</span>
        </span>
      </a>
      ${received ? '' : `
        <button type="button" class="btn btn--small btn--ghost row-with-action__button" data-action="receive" data-id="${i.id}" data-date="${i.date}">
          ${icon('check-circle')}Marcar como recibido</button>`}
    </li>`;
}

// ---------- Cuánto falta asignar ----------

function allocationCard(budget) {
  const s = budget.summary;
  const free = Number(s.unassignedPlannedIncome);
  return `
    <section class="card" aria-labelledby="plan-allocation">
      <h2 id="plan-allocation" class="card__title">${icon('target')}Distribución del presupuesto</h2>
      <ul class="summary-list">
        <li class="summary-row"><span>Ingresos planificados<small>recibidos + esperados</small></span><span class="amount">${formatMoney(s.plannedIncome)}</span></li>
        <li class="summary-row"><span>Presupuesto asignado</span><span class="amount">−${formatMoney(s.budgetTotal)}</span></li>
        <li class="summary-row summary-row--total">
          <span>${free >= 0 ? 'Falta asignar' : 'Presupuestado de más'}</span>
          <span class="amount ${free < 0 ? 'is-negative' : 'amount--income'}">${formatMoney(Math.abs(free))}</span>
        </li>
      </ul>
      <p class="muted small">Presupuestar es un plan: no registra gastos ni mueve dinero.</p>
      <a class="btn btn--primary btn--block" href="#/presupuesto/${planView.month}">
        ${icon('target')}${budget.hasBudget ? 'Editar presupuesto' : 'Armar presupuesto'}</a>
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

// ---------- Presupuesto por categoría ----------

function budgetCard(budget) {
  const visible = budget.categories.filter((c) => c.assigned || Number(c.spent) > 0 || Number(c.pendingRecurring) > 0);
  return `
    <section class="card" aria-labelledby="plan-categories">
      <h2 id="plan-categories" class="card__title">${icon('pie')}Por categoría</h2>
      ${visible.length === 0
        ? '<p class="empty-text">Cuando armes el presupuesto vas a ver acá cuánto te queda en cada categoría.</p>'
        : `<p class="muted small">Restante = asignado − gastado − comprometido (gastos fijos pendientes).</p>
           <ul class="budget-list">${visible.map(budgetLine).join('')}</ul>`}
    </section>`;
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
        Asignado ${formatMoney(budget)} · Gastado ${formatMoney(spent)} · Comprometido ${formatMoney(pending)}
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
    <section class="card" aria-labelledby="plan-fixed">
      <h2 id="plan-fixed" class="card__title">${icon('repeat')}Gastos fijos del mes</h2>
      ${obligations.length === 0 ? `
        <p class="empty-text">No hay gastos fijos en ${formatMonth(planView.month).toLowerCase()}.</p>
        <p class="muted small">Configurá una vez el alquiler, los servicios o las suscripciones y la app los prepara cada mes.</p>` : `
        <p class="muted small">${pending.length === 0 ? 'Todo pagado o resuelto.' : `${pending.length} ${pending.length === 1 ? 'pendiente' : 'pendientes'} por ${formatMoney(pending.reduce((t, o) => t + Number(o.amount), 0))}. Tocá uno para pagarlo o vincularlo con un gasto ya cargado.`}</p>
        <ul class="expense-list">${obligations.map(obligationRow).join('')}</ul>`}
      <div class="button-row">
        <a class="btn btn--outline" href="#/fijo/nuevo">${icon('plus-circle')}Nuevo gasto fijo</a>
        <a class="btn btn--soft" href="#/fijos">${icon('repeat')}Gestionar</a>
      </div>
    </section>`;
}

function obligationRow(o) {
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
          <span class="amount ${o.status === 'SKIPPED' ? 'amount--muted' : ''}">−${formatMoney(amount)}</span>
          <span class="tag ${status.css}">${status.label}</span>
        </span>
      </a>
    </li>`;
}

// ---------- Lo registrado en el mes ----------

function recordedCard(s) {
  const row = (label, value, { strong = false, sign = false } = {}) => {
    const n = Number(value);
    return `
      <li class="summary-row ${strong ? 'summary-row--total' : ''}">
        <span>${label}</span>
        <span class="amount ${strong && n < 0 ? 'is-negative' : ''}">${sign && n > 0 ? '+' : ''}${formatMoney(n)}</span>
      </li>`;
  };
  return `
    <section class="card" aria-labelledby="plan-recorded">
      <h2 id="plan-recorded" class="card__title">${icon('wallet')}Registrado en el mes</h2>
      <ul class="summary-list">
        ${row('Ingresos recibidos', s.incomeReceived)}
        ${row('Egresos reales', -s.expenses)}
        ${row('Balance registrado del mes', s.registeredBalance, { strong: true, sign: true })}
        ${row('Comprometido en gastos fijos pendientes', -s.pendingRecurring)}
        ${row('Balance después de pendientes', s.balanceAfterPending, { strong: true, sign: true })}
      </ul>
      <p class="muted small">Solo cuenta lo registrado en este mes: no es el saldo de tu cuenta.</p>
    </section>`;
}
