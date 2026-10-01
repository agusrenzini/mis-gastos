// Formulario de ingreso:
//   #/ingreso/nuevo               → nuevo ingreso manual
//   #/ingreso/esperado/2026-11    → nuevo ingreso esperado para ese mes (desde Plan)
//   #/ingreso/12                  → consultar, editar, marcar como recibido o eliminar
//   voz                           → confirmación de un ingreso dictado (lo abre voice-confirm.js)
import { api } from '../api.js';
import { INCOME_TYPES } from '../categories.js';
import { todayISO } from '../dates.js';
import { formatAmountInput, formatMoney, formatMonth, parseAmountInput } from '../format.js';
import { getLastSection } from '../state.js';
import { confirmDialog, errorState, escapeHtml, icon, loadingState, showToast, topBar } from '../ui.js';
import { kindSwitch } from './expense-form.js';

const MAX_AMOUNT = 9_999_999_999.99;

/**
 * id: editar uno existente · expectedMonth: "2026-11" para cargar un esperado de ese mes ·
 * voice: datos interpretados por voz · onSwitchKind(kind, edits): pasar a egreso sin perder lo cargado.
 */
export function renderIncomeForm(root, { id = null, expectedMonth = null, voice = null, onSwitchKind = null, onSaved = null } = {}) {
  const back = getLastSection(expectedMonth ? '#/plan' : '#/movimientos');
  if (voice) {
    mount(root, voice, null, { back, mode: 'voice', onSwitchKind, onSaved });
    return;
  }
  if (!id) {
    const today = todayISO();
    const values = expectedMonth
      ? { description: 'Sueldo', amount: null, date: expectedMonth === today.slice(0, 7) ? today : `${expectedMonth}-01`,
          type: 'SUELDO', status: 'EXPECTED' }
      : { description: '', amount: null, date: today, type: 'SUELDO', status: 'RECEIVED' };
    mount(root, values, null, { back, mode: expectedMonth ? 'expected' : 'new' });
    return;
  }
  const load = async () => {
    root.innerHTML = topBar('Ingreso', { back }) + loadingState();
    try {
      mount(root, await api.getIncome(id), id, { back, mode: 'edit' });
    } catch (error) {
      root.innerHTML = topBar('Ingreso', { back }) + errorState(error.message);
      root.querySelector('[data-action="retry"]')?.addEventListener('click', load);
    }
  };
  load();
}

function mount(root, values, id, { back: BACK, mode, onSwitchKind = null, onSaved = null }) {
  const editing = Boolean(id);
  const title = editing ? 'Editar ingreso'
    : mode === 'voice' ? 'Confirmar movimiento'
      : mode === 'expected' ? `Ingreso esperado · ${formatMonth(values.date.slice(0, 7))}` : 'Nuevo ingreso';
  root.innerHTML = `
    ${topBar(title, { back: BACK })}
    ${editing ? '<p class="kind-badge kind-badge--income">+ Ingreso</p>' : kindSwitch('INCOME')}
    ${mode === 'voice' ? `
      <section class="confirm-intro">
        <span class="pill pill--mint">Capturado por voz</span>
        <h2 class="confirm-intro__title">¿Está bien este ingreso?</h2>
        <p class="transcript-pill">${icon('mic')}<q>${escapeHtml(values.transcript)}</q></p>
      </section>` : ''}
    ${mode === 'expected' ? `
      <p class="notice">${icon('info')}<span>Un ingreso <strong>esperado</strong> sirve para planificar: todavía no es dinero disponible. Cuando lo cobres, marcalo como recibido.</span></p>` : ''}
    <form class="expense-form" novalidate>
      <div class="form-alert" role="alert" hidden></div>

      <section class="card amount-card">
        <label class="amount-card__label" for="amount">${mode === 'voice' ? 'Monto detectado' : 'Importe del ingreso'}</label>
        <div class="amount-card__row">
          <span class="amount-card__currency" aria-hidden="true">$</span>
          <input id="amount" name="amount" class="amount-card__input amount" inputmode="decimal" autocomplete="off"
                 placeholder="0" value="${formatAmountInput(values.amount)}" aria-describedby="amount-error">
        </div>
        ${mode === 'voice' && !values.amount ? '<p class="field-hint">No pude detectar el monto: ingresalo.</p>' : ''}
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
        <a class="btn btn--text btn--block" href="${BACK}">${mode === 'voice' ? 'Descartar' : 'Cancelar'}</a>
      </div>
    </form>`;

  const form = root.querySelector('form');

  root.querySelector('.kind-switch')?.addEventListener('change', (event) => {
    if (event.target.value !== 'EXPENSE') return;
    const amount = parseAmountInput(form.elements.amount.value);
    const edits = { amount: amount > 0 ? amount : null, date: form.elements.date.value || todayISO() };
    if (onSwitchKind) onSwitchKind('EXPENSE', edits);
    else location.hash = '#/nuevo';
  });

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

  let saving = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return; // un segundo toque mientras se guarda no crea otro ingreso
    const payload = read(form);
    if (!payload) return;
    saving = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.querySelector('.form-alert').hidden = true;
    try {
      if (editing) await api.updateIncome(id, payload);
      else await api.createIncome(payload);
      onSaved?.();
      showToast(editing ? 'Cambios guardados' : `Ingreso de ${formatMoney(payload.amount)} guardado`);
      location.hash = BACK;
    } catch (error) {
      showErrors(form, error);
      saving = false;
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
