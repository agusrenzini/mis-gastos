// Formulario de ingreso: nuevo (#/ingreso/nuevo) o consultar, editar y eliminar (#/ingreso/12).
import { api } from '../api.js';
import { INCOME_TYPES } from '../categories.js';
import { todayISO } from '../dates.js';
import { formatAmountInput, formatMoney, parseAmountInput } from '../format.js';
import { confirmDialog, errorState, escapeHtml, icon, loadingState, showToast, topBar } from '../ui.js';

const MAX_AMOUNT = 9_999_999_999.99;
const BACK = '#/ingresos';

export function renderIncomeForm(root, { id } = {}) {
  if (!id) {
    mount(root, { description: '', amount: null, date: todayISO(), type: 'SUELDO', status: 'RECEIVED' });
    return;
  }
  const load = async () => {
    root.innerHTML = topBar('Ingreso', { back: BACK }) + loadingState();
    try {
      mount(root, await api.getIncome(id), id);
    } catch (error) {
      root.innerHTML = topBar('Ingreso', { back: BACK }) + errorState(error.message);
      root.querySelector('[data-action="retry"]')?.addEventListener('click', load);
    }
  };
  load();
}

function mount(root, values, id) {
  const editing = Boolean(id);
  root.innerHTML = `
    ${topBar(editing ? 'Editar ingreso' : 'Nuevo ingreso', { back: BACK })}
    <form class="expense-form" novalidate>
      <div class="form-alert" role="alert" hidden></div>

      <section class="card amount-card">
        <label class="amount-card__label" for="amount">Importe del ingreso</label>
        <div class="amount-card__row">
          <span class="amount-card__currency" aria-hidden="true">$</span>
          <input id="amount" name="amount" class="amount-card__input amount" inputmode="decimal" autocomplete="off"
                 placeholder="0" value="${formatAmountInput(values.amount)}" aria-describedby="amount-error">
        </div>
        <p id="amount-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <label class="field-label" for="description">${icon('text')}Concepto</label>
        <input id="description" name="description" class="input" maxlength="120" autocomplete="off"
               placeholder="Ej. Sueldo de octubre" value="${escapeHtml(values.description)}" aria-describedby="description-error">
        <p id="description-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <span id="status-label" class="field-label">${icon('check-circle')}Estado</span>
        <div class="segmented" role="radiogroup" aria-labelledby="status-label">
          ${radio('status', 'RECEIVED', 'Recibido', values.status, 'segment')}
          ${radio('status', 'EXPECTED', 'Esperado', values.status, 'segment')}
        </div>
        <p class="field-hint" data-slot="status-hint"></p>
      </section>

      <section class="card">
        <label class="field-label" for="date">${icon('calendar')}<span data-slot="date-label">Fecha</span></label>
        <input id="date" name="date" type="date" class="input" value="${values.date}" aria-describedby="date-error">
        <p id="date-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <span id="type-label" class="field-label">${icon('shapes')}Tipo</span>
        <div class="option-grid option-grid--3" role="radiogroup" aria-labelledby="type-label">
          ${INCOME_TYPES.map((t) => radio('type', t.key,
            `<span class="option-tile__emoji" aria-hidden="true">${t.emoji}</span>${t.label}`, values.type, 'option option-tile')).join('')}
        </div>
        <p id="type-error" class="field-error" hidden></p>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary btn--block btn--lg">${icon('check-circle')}<span>Guardar ingreso</span></button>
        ${editing && values.status === 'EXPECTED'
          ? `<button type="button" class="btn btn--soft btn--block" data-action="receive">${icon('income')}Marcar como recibido</button>` : ''}
        ${editing ? `<button type="button" class="btn btn--danger-ghost btn--block" data-action="delete">${icon('trash')}Eliminar ingreso</button>` : ''}
        <a class="btn btn--text btn--block" href="${BACK}">Cancelar</a>
      </div>
    </form>`;

  const form = root.querySelector('form');
  const refresh = () => {
    const received = form.elements.status.value === 'RECEIVED';
    root.querySelector('[data-slot="status-hint"]').textContent = received
      ? 'Ya lo cobraste: cuenta como dinero ingresado.'
      : 'Todavía no lo cobraste: sirve para planificar, pero no cuenta como ingresado.';
    root.querySelector('[data-slot="date-label"]').textContent = received ? 'Fecha de cobro' : 'Fecha esperada';
    if (received) form.elements.date.max = todayISO();
    else form.elements.date.removeAttribute('max');
  };
  form.addEventListener('change', (event) => {
    hideError(form, event.target.name);
    refresh();
  });
  form.elements.amount.addEventListener('input', () => hideError(form, 'amount'));
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
      if (editing) await api.updateIncome(id, payload);
      else await api.createIncome(payload);
      showToast(editing ? 'Cambios guardados' : `Ingreso de ${formatMoney(payload.amount)} guardado`);
      location.hash = BACK;
    } catch (error) {
      showErrors(form, error);
      button.disabled = false;
    }
  });

  form.querySelector('[data-action="receive"]')?.addEventListener('click', async () => {
    try {
      await api.receiveIncome(id);
      showToast('Ingreso marcado como recibido');
      location.hash = BACK;
    } catch (error) {
      showErrors(form, error);
    }
  });

  form.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '¿Eliminar este ingreso?',
      message: `${values.description} · ${formatMoney(values.amount)}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteIncome(id);
      showToast('Ingreso eliminado');
      location.hash = BACK;
    } catch (error) {
      showErrors(form, error);
    }
  });

  refresh();
}

function radio(name, value, labelHtml, selected, className) {
  return `
    <label class="${className}">
      <input type="radio" name="${name}" value="${value}" ${value === selected ? 'checked' : ''}>
      <span>${labelHtml}</span>
    </label>`;
}

function read(form) {
  const errors = {};
  const amount = parseAmountInput(form.elements.amount.value);
  if (!(amount > 0)) errors.amount = 'Ingresá un importe mayor a cero (ej. 250.000).';
  else if (amount > MAX_AMOUNT) errors.amount = 'El importe es demasiado grande.';
  const description = form.elements.description.value.trim();
  if (!description) errors.description = 'Escribí un concepto (ej. Sueldo).';
  const status = form.elements.status.value;
  const date = form.elements.date.value;
  if (!date) errors.date = 'Elegí una fecha.';
  else if (status === 'RECEIVED' && date > todayISO()) {
    errors.date = 'Un ingreso recibido no puede tener fecha futura. Si todavía no lo cobraste, marcalo como esperado.';
  }
  if (Object.keys(errors).length) {
    showErrors(form, { errors });
    return null;
  }
  return { description, amount, date, type: form.elements.type.value, status };
}

/** Errores por campo debajo de cada uno; si no hay, el mensaje general arriba. */
export function showErrors(form, error) {
  let shown = false;
  Object.entries(error.errors ?? {}).forEach(([name, message]) => {
    const el = form.querySelector(`#${name}-error`);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    shown = true;
  });
  if (!shown && error.message) {
    const alert = form.querySelector('.form-alert');
    alert.textContent = error.message;
    alert.hidden = false;
    alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function hideError(form, name) {
  const el = name && form.querySelector(`#${name}-error`);
  if (el) el.hidden = true;
}
