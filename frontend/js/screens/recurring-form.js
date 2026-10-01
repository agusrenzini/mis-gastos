// Gasto fijo: nuevo (#/fijo/nuevo) o editar, pausar, finalizar y eliminar (#/fijo/3).
import { api } from '../api.js';
import { CATEGORIES } from '../categories.js';
import { monthOf, todayISO } from '../dates.js';
import { formatAmountInput, formatMoney, formatMonth, parseAmountInput } from '../format.js';
import { confirmDialog, errorState, escapeHtml, icon, loadingState, showToast, topBar } from '../ui.js';
import { hideError, showErrors } from './income-form.js';
import { RECURRING_STATES } from './recurring.js';

const BACK = '#/fijos';
const MAX_AMOUNT = 9_999_999_999.99;

export function renderRecurringForm(root, { id } = {}) {
  if (!id) {
    mount(root, { description: '', category: null, amount: null, dueDay: 10, startMonth: monthOf(todayISO()), endMonth: null });
    return;
  }
  const load = async () => {
    root.innerHTML = topBar('Gasto fijo', { back: BACK }) + loadingState();
    try {
      mount(root, await api.getRecurring(id), id);
    } catch (error) {
      root.innerHTML = topBar('Gasto fijo', { back: BACK }) + errorState(error.message);
      root.querySelector('[data-action="retry"]')?.addEventListener('click', load);
    }
  };
  load();
}

function mount(root, values, id) {
  const editing = Boolean(id);
  const state = editing ? RECURRING_STATES[values.state] : null;

  root.innerHTML = `
    ${topBar(editing ? 'Editar gasto fijo' : 'Nuevo gasto fijo', { back: BACK })}
    ${editing ? `
      <section class="card recurring-status">
        <div class="recurring-status__head">
          <span>Estado</span><span class="tag ${state.css}">${state.label}</span>
        </div>
        <p class="muted small">${stateHelp(values)}</p>
        <div class="recurring-status__actions">
          ${values.state === 'PAUSED'
            ? `<button type="button" class="btn btn--soft btn--small" data-action="resume">Reanudar</button>`
            : values.state !== 'FINISHED' ? `<button type="button" class="btn btn--soft btn--small" data-action="pause">Pausar</button>` : ''}
          ${values.state === 'ACTIVE' || values.state === 'PAUSED'
            ? `<button type="button" class="btn btn--outline btn--small" data-action="finish">Cancelar gasto fijo</button>` : ''}
        </div>
      </section>` : ''}

    <form class="expense-form" novalidate>
      <div class="form-alert" role="alert" hidden></div>

      <section class="card amount-card">
        <label class="amount-card__label" for="amount">Importe previsto por mes</label>
        <div class="amount-card__row">
          <span class="amount-card__currency" aria-hidden="true">$</span>
          <input id="amount" name="amount" class="amount-card__input amount" inputmode="decimal" autocomplete="off"
                 placeholder="0" value="${formatAmountInput(values.amount)}" aria-describedby="amount-error amount-hint">
        </div>
        <p id="amount-hint" class="field-hint">Si una factura viene distinta, la ajustás en ese mes.</p>
        <p id="amount-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <label class="field-label" for="description">${icon('text')}Concepto</label>
        <input id="description" name="description" class="input" maxlength="120" autocomplete="off"
               placeholder="Ej. Alquiler, Internet, Gimnasio" value="${escapeHtml(values.description)}" aria-describedby="description-error">
        <p id="description-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <label class="field-label" for="dueDay">${icon('calendar')}Día de vencimiento</label>
        <input id="dueDay" name="dueDay" type="number" class="input" min="1" max="31" inputmode="numeric"
               value="${values.dueDay ?? ''}" aria-describedby="dueDay-hint dueDay-error">
        <p id="dueDay-hint" class="field-hint">Si el mes no tiene ese día (por ejemplo, 31), vence el último día del mes.</p>
        <p id="dueDay-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <div class="month-fields">
          <div>
            <label class="field-label" for="startMonth">Desde</label>
            <input id="startMonth" name="startMonth" type="month" class="input" value="${values.startMonth}" aria-describedby="startMonth-error">
            <p id="startMonth-error" class="field-error" hidden></p>
          </div>
          <div>
            <label class="field-label" for="endMonth">Hasta <small class="muted">(opcional)</small></label>
            <input id="endMonth" name="endMonth" type="month" class="input" value="${values.endMonth ?? ''}" aria-describedby="endMonth-error">
            <p id="endMonth-error" class="field-error" hidden></p>
          </div>
        </div>
        <p class="field-hint">Sin mes de fin, se repite todos los meses hasta que lo finalices.</p>
      </section>

      <section class="card">
        <span id="category-label" class="field-label">${icon('shapes')}Categoría</span>
        <div class="option-grid option-grid--3" role="radiogroup" aria-labelledby="category-label">
          ${CATEGORIES.map((c) => `
            <label class="option option-tile">
              <input type="radio" name="category" value="${c.key}" ${c.key === values.category ? 'checked' : ''}>
              <span><span class="option-tile__emoji" aria-hidden="true">${c.emoji}</span>${c.label}</span>
            </label>`).join('')}
        </div>
        <p id="category-error" class="field-error" hidden></p>
      </section>

      ${editing ? '<p class="muted small">Los cambios se aplican desde este mes. Los meses ya pagados no se modifican.</p>' : ''}

      <div class="form-actions">
        <button type="submit" class="btn btn--primary btn--block btn--lg">${icon('check-circle')}<span>Guardar</span></button>
        ${editing ? `<button type="button" class="btn btn--danger-ghost btn--block" data-action="delete">${icon('trash')}Eliminar</button>` : ''}
        <a class="btn btn--text btn--block" href="${BACK}">Cancelar</a>
      </div>
    </form>`;

  const form = root.querySelector('form');
  form.addEventListener('input', (event) => hideError(form, event.target.name));
  form.addEventListener('change', (event) => hideError(form, event.target.name));
  form.elements.amount.addEventListener('blur', () => {
    const value = parseAmountInput(form.elements.amount.value);
    if (value > 0) form.elements.amount.value = formatAmountInput(value);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = read(form);
    if (!payload) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.querySelector('.form-alert').hidden = true;
    try {
      if (editing) await api.updateRecurring(id, payload);
      else await api.createRecurring(payload);
      showToast(editing ? 'Cambios guardados' : 'Gasto fijo creado');
      location.hash = BACK;
    } catch (error) {
      showErrors(form, error);
      button.disabled = false;
    }
  });

  const act = async (action, { confirm, done }) => {
    if (confirm && !(await confirmDialog(confirm))) return;
    try {
      await action();
      showToast(done);
      location.hash = BACK;
    } catch (error) {
      showErrors(form, error);
    }
  };

  root.querySelector('[data-action="pause"]')?.addEventListener('click', () => act(() => api.pauseRecurring(id), {
    confirm: {
      title: `¿Pausar ${values.description}?`,
      message: 'No se van a preparar los meses siguientes hasta que lo reanudes. Los meses anteriores y el actual se conservan.',
      confirmLabel: 'Pausar',
    },
    done: 'Gasto fijo pausado',
  }));
  root.querySelector('[data-action="resume"]')?.addEventListener('click', () => act(() => api.resumeRecurring(id), {
    done: 'Gasto fijo reanudado desde este mes',
  }));
  root.querySelector('[data-action="finish"]')?.addEventListener('click', () => act(() => api.finishRecurring(id), {
    confirm: {
      title: `¿Cancelar ${values.description}?`,
      message: `Termina en ${formatMonth(monthOf(todayISO())).toLowerCase()}: no se preparan meses siguientes. Los meses anteriores y lo pagado se conservan.`,
      confirmLabel: 'Cancelar gasto fijo',
    },
    done: 'Gasto fijo cancelado desde el mes que viene',
  }));
  form.querySelector('[data-action="delete"]')?.addEventListener('click', () => act(() => api.deleteRecurring(id), {
    confirm: {
      title: `¿Eliminar ${values.description}?`,
      message: 'Se borran la configuración y los meses sin pagar. Si ya tiene meses pagados, usá “Cancelar gasto fijo” para conservar el historial.',
      confirmLabel: 'Eliminar',
      danger: true,
    },
    done: 'Gasto fijo eliminado',
  }));
}

function stateHelp(values) {
  if (values.state === 'PAUSED') return 'No se preparan meses nuevos. Al reanudarlo, sigue desde el mes actual.';
  if (values.state === 'FINISHED') return `Terminó en ${formatMonth(values.endMonth).toLowerCase()}. Su historial se conserva.`;
  if (values.state === 'SCHEDULED') return `Empieza en ${formatMonth(values.startMonth).toLowerCase()}.`;
  const paid = values.paidCount ? ` Llevás ${values.paidCount} ${values.paidCount === 1 ? 'mes pagado' : 'meses pagados'}.` : '';
  return `Se prepara un pago por mes de ${formatMoney(values.amount)}.${paid}`;
}

function read(form) {
  const errors = {};
  const amount = parseAmountInput(form.elements.amount.value);
  if (!(amount > 0)) errors.amount = 'Ingresá un importe mayor a cero.';
  else if (amount > MAX_AMOUNT) errors.amount = 'El importe es demasiado grande.';
  const description = form.elements.description.value.trim();
  if (!description) errors.description = 'Escribí un concepto (ej. Alquiler).';
  const dueDay = Number(form.elements.dueDay.value);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) errors.dueDay = 'Elegí un día entre 1 y 31.';
  const startMonth = form.elements.startMonth.value;
  const endMonth = form.elements.endMonth.value || null;
  const monthPattern = /^\d{4}-\d{2}$/;
  if (!monthPattern.test(startMonth)) errors.startMonth = 'Elegí el mes de inicio (ej. 2026-10).';
  if (endMonth && !monthPattern.test(endMonth)) errors.endMonth = 'Usá el formato año-mes (ej. 2026-12).';
  else if (endMonth && endMonth < startMonth) errors.endMonth = 'El mes de fin no puede ser anterior al de inicio.';
  const category = form.elements.category.value;
  if (!category) errors.category = 'Elegí una categoría.';
  if (Object.keys(errors).length) {
    showErrors(form, { errors });
    return null;
  }
  return { description, category, amount, dueDay, startMonth, endMonth };
}
