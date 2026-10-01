// Editar el presupuesto de un mes (#/presupuesto/2026-10): un importe por categoría.
import { api } from '../api.js';
import { CATEGORIES } from '../categories.js';
import { addMonths } from '../dates.js';
import { formatAmountInput, formatMoney, formatMonth, parseAmountInput } from '../format.js';
import { errorState, icon, loadingState, showToast, topBar } from '../ui.js';

const BACK = '#/plan';
const MAX_AMOUNT = 9_999_999_999.99;

export function renderBudgetForm(root, [month]) {
  const load = async () => {
    root.innerHTML = topBar('Presupuesto', { back: BACK }) + loadingState();
    try {
      mount(root, month, await api.getBudget(month));
    } catch (error) {
      root.innerHTML = topBar('Presupuesto', { back: BACK }) + errorState(error.message);
      root.querySelector('[data-action="retry"]')?.addEventListener('click', load);
    }
  };
  load();
}

function mount(root, month, budget) {
  const byCategory = Object.fromEntries(budget.categories.map((c) => [c.category, c]));
  const planned = Number(budget.summary.plannedIncome);
  const previous = addMonths(month, -1);

  root.innerHTML = `
    ${topBar('Presupuesto', { back: BACK })}
    <p class="pill pill--lg budget-month">${icon('calendar')}${formatMonth(month)}</p>

    <p class="notice">${icon('info')}<span>Asignar un presupuesto es un plan: <strong>no registra gastos ni mueve dinero</strong>.</span></p>

    <section class="card">
      <ul class="summary-list">
        <li class="summary-row"><span>Ingresos recibidos</span><span class="amount">${formatMoney(budget.summary.incomeReceived)}</span></li>
        <li class="summary-row"><span>Ingresos esperados</span><span class="amount">${formatMoney(budget.summary.incomeExpectedPending)}</span></li>
        <li class="summary-row summary-row--total"><span>Ingresos planificados</span><span class="amount">${formatMoney(planned)}</span></li>
      </ul>
      ${planned === 0 ? `<p class="muted small">No cargaste ingresos para este mes. Podés <a class="link" href="#/ingreso/nuevo">agregar uno esperado</a> para planificar.</p>` : ''}
    </section>

    ${budget.hasPreviousBudget ? `
      <button type="button" class="btn btn--outline btn--block" data-action="copy">
        ${icon('repeat')}Copiar el presupuesto de ${formatMonth(previous).toLowerCase()}</button>` : ''}

    <form class="budget-form" novalidate>
      <div class="form-alert" role="alert" hidden></div>
      <section class="card">
        <h2 class="card__title">${icon('target')}Importe por categoría</h2>
        <ul class="budget-inputs">
          ${CATEGORIES.map((c) => {
            const line = byCategory[c.key];
            const used = Number(line?.spent ?? 0) + Number(line?.pendingRecurring ?? 0);
            return `
              <li class="budget-input">
                <label for="b-${c.key}">
                  <span class="budget-input__name">${c.emoji} ${c.label}</span>
                  ${used > 0 ? `<small>Gastado y fijos: ${formatMoney(used)}</small>` : ''}
                </label>
                <span class="budget-input__field">
                  <span aria-hidden="true">$</span>
                  <input id="b-${c.key}" name="${c.key}" class="input amount" inputmode="decimal" autocomplete="off"
                         placeholder="0" value="${line?.assigned ? formatAmountInput(line.budget) : ''}">
                </span>
              </li>`;
          }).join('')}
        </ul>
      </section>

      <section class="card budget-totals" aria-live="polite">
        <div class="summary-row summary-row--total"><span>Total presupuestado</span><span class="amount" data-slot="total"></span></div>
        <div class="summary-row"><span>Ingresos planificados sin asignar</span><span class="amount" data-slot="free"></span></div>
        <p class="notice notice--warn" data-slot="over" hidden>${icon('alert')}<span>El total supera tus ingresos planificados. Podés guardarlo igual.</span></p>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary btn--block btn--lg">${icon('check-circle')}<span>Guardar presupuesto</span></button>
        <a class="btn btn--text btn--block" href="${BACK}">Cancelar</a>
      </div>
    </form>`;

  const form = root.querySelector('form');

  const readItems = () => CATEGORIES.map((c) => {
    const text = form.elements[c.key].value.trim();
    return { category: c.key, amount: text === '' ? 0 : parseAmountInput(text) };
  });

  const refresh = () => {
    const total = readItems().reduce((sum, i) => sum + (Number.isFinite(i.amount) ? i.amount : 0), 0);
    const free = planned - total;
    root.querySelector('[data-slot="total"]').textContent = formatMoney(total);
    const freeEl = root.querySelector('[data-slot="free"]');
    freeEl.textContent = formatMoney(free);
    freeEl.classList.toggle('is-negative', free < 0);
    root.querySelector('[data-slot="over"]').hidden = !(total > planned);
  };

  form.addEventListener('input', refresh);
  form.addEventListener('focusout', (event) => {
    const input = event.target;
    if (!input.matches?.('input')) return;
    const value = parseAmountInput(input.value);
    if (value > 0) input.value = formatAmountInput(value);
  });

  root.querySelector('[data-action="copy"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const prev = await api.getBudget(previous);
      prev.categories.forEach((line) => {
        form.elements[line.category].value = line.assigned ? formatAmountInput(line.budget) : '';
      });
      refresh();
      showToast(`Copiado de ${formatMonth(previous).toLowerCase()}: revisalo y guardá`);
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const items = readItems();
    const invalid = items.find((i) => !Number.isFinite(i.amount) || i.amount < 0 || i.amount > MAX_AMOUNT);
    const alert = form.querySelector('.form-alert');
    if (invalid) {
      alert.textContent = 'Revisá los importes: usá solo números (ej. 25.000).';
      alert.hidden = false;
      form.elements[invalid.category].focus();
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    alert.hidden = true;
    try {
      await api.saveBudget(month, items);
      showToast('Presupuesto guardado');
      location.hash = BACK;
    } catch (error) {
      alert.textContent = error.message;
      alert.hidden = false;
      button.disabled = false;
    }
  });

  refresh();
}
