// Formulario de egreso (gasto). Se usa en tres modos:
//   "new"   → Nuevo egreso manual
//   "voice" → Confirmación de un movimiento dictado (viene prellenado por el parser)
//   "edit"  → Consultar, modificar o eliminar un egreso existente
// En "new" y "voice" arriba hay un selector Egreso / Ingreso para cambiar de tipo.
import { api } from '../api.js';
import { CATEGORIES, PAYMENT_METHODS, getCategory } from '../categories.js';
import { addDays, todayISO } from '../dates.js';
import { formatAmountInput, formatDate, formatMoney, parseAmountInput } from '../format.js';
import { getLastSection, getPreferredPaymentMethod, setPreferredPaymentMethod, takeVoiceDraft } from '../state.js';
import { confirmDialog, errorState, escapeHtml, icon, loadingState, showToast, topBar } from '../ui.js';

const MAX_AMOUNT = 9_999_999_999.99;

/**
 * draft: datos ya interpretados (modo voz). onSwitchKind(kind, edits): cambiar a ingreso sin perder lo cargado.
 * onSaved: se llama una vez guardado.
 */
export function renderExpenseForm(root, { mode, id, draft: given = null, onSwitchKind = null, onSaved = null }) {
  if (mode === 'voice') {
    const draft = given ?? takeVoiceDraft();
    if (!draft) {
      location.replace('#/voz');
      return;
    }
    mount(root, mode, {
      amount: draft.amount,
      description: draft.description,
      date: draft.date,
      category: draft.category,
      paymentMethod: draft.paymentMethod ?? getPreferredPaymentMethod(),
      source: 'VOICE',
      voiceTranscript: draft.transcript,
    }, null, { onSwitchKind, onSaved });
    return;
  }

  if (mode === 'new') {
    mount(root, mode, {
      amount: null,
      description: '',
      date: todayISO(),
      category: null,
      paymentMethod: getPreferredPaymentMethod(),
      source: 'MANUAL',
      voiceTranscript: null,
    });
    return;
  }

  // Edición: primero se carga el gasto
  const load = async () => {
    root.innerHTML = topBar('Editar gasto', { back: '#/movimientos' }) + loadingState();
    try {
      mount(root, mode, await api.getExpense(id), id);
    } catch (error) {
      root.innerHTML = topBar('Editar gasto', { back: '#/movimientos' }) + errorState(error.message);
      root.querySelector('[data-action="retry"]')?.addEventListener('click', load);
    }
  };
  load();
}

function mount(root, mode, values, id, { onSwitchKind = null, onSaved = null } = {}) {
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const dateChoice = values.date === today ? 'today' : values.date === yesterday ? 'yesterday' : 'other';
  const exitTo = getLastSection(mode === 'edit' ? '#/movimientos' : '#/inicio');

  const title = mode === 'edit' ? 'Editar egreso' : mode === 'voice' ? 'Confirmar movimiento' : 'Nuevo egreso';
  const action = mode === 'new'
    ? `<a class="icon-button icon-button--primary" href="#/voz" aria-label="Registrar por voz">${icon('mic')}</a>`
    : '';

  root.innerHTML = `
    ${topBar(title, { back: exitTo, action })}
    ${mode !== 'edit' ? kindSwitch('EXPENSE') : '<p class="kind-badge kind-badge--expense">− Egreso</p>'}
    ${mode === 'voice' ? `
      <section class="confirm-intro">
        <span class="pill pill--mint">Capturado por voz</span>
        <h2 class="confirm-intro__title">¿Está bien este egreso?</h2>
        <p class="transcript-pill">${icon('mic')}<q>${escapeHtml(values.voiceTranscript)}</q></p>
      </section>` : ''}
    ${mode === 'edit' && values.voiceTranscript ? `
      <p class="transcript-pill transcript-pill--left">${icon('mic')}<q>${escapeHtml(values.voiceTranscript)}</q></p>` : ''}

    <form class="expense-form" novalidate>
      <div class="form-alert" role="alert" hidden></div>

      <section class="card amount-card">
        <label class="amount-card__label" for="amount">${mode === 'voice' ? 'Monto detectado' : 'Importe del gasto'}</label>
        <div class="amount-card__row">
          <span class="amount-card__currency" aria-hidden="true">$</span>
          <input id="amount" name="amount" class="amount-card__input amount" inputmode="decimal" autocomplete="off"
                 placeholder="0" value="${formatAmountInput(values.amount)}" aria-describedby="amount-error amount-hint">
        </div>
        <p id="amount-hint" class="field-hint">${mode === 'voice' && !values.amount
          ? 'No pude detectar el monto: ingresalo.'
          : 'Ingresá el monto total abonado'}</p>
        <p id="amount-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <label class="field-label" for="description">${icon('text')}Descripción</label>
        <input id="description" name="description" class="input" maxlength="120" autocomplete="off"
               placeholder="¿En qué gastaste? (ej. Almuerzo con amigos)"
               value="${escapeHtml(values.description)}" aria-describedby="description-error">
        <p id="description-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <div class="field-head">
          <span id="date-label" class="field-label">${icon('calendar')}Fecha</span>
          <span class="field-head__hint" data-slot="date-text"></span>
        </div>
        <div class="segmented" role="radiogroup" aria-labelledby="date-label">
          ${radio('dateChoice', 'today', 'Hoy', dateChoice)}
          ${radio('dateChoice', 'yesterday', 'Ayer', dateChoice)}
          ${radio('dateChoice', 'other', `${icon('calendar-edit')}Otra`, dateChoice)}
        </div>
        <label class="visually-hidden" for="customDate">Elegir fecha</label>
        <input id="customDate" name="customDate" type="date" class="input custom-date" max="${today}"
               value="${values.date}" ${dateChoice === 'other' ? '' : 'hidden'} aria-describedby="date-error">
        <p id="date-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <div class="field-head">
          <span id="payment-label" class="field-label">${icon('wallet')}Forma de pago</span>
        </div>
        <div class="option-grid option-grid--2" role="radiogroup" aria-labelledby="payment-label">
          ${PAYMENT_METHODS.map((p) =>
            radio('paymentMethod', p.key, `${icon(p.icon)}${p.label}`, values.paymentMethod, 'option')).join('')}
        </div>
        <p id="paymentMethod-error" class="field-error" hidden></p>
      </section>

      <section class="card">
        <div class="field-head">
          <span id="category-label" class="field-label">${icon('shapes')}Categoría</span>
          <span class="field-head__hint field-head__hint--primary" data-slot="category-text"></span>
        </div>
        <div class="option-grid option-grid--3" role="radiogroup" aria-labelledby="category-label">
          ${CATEGORIES.map((c) => radio('category', c.key,
            `<span class="option-tile__emoji" aria-hidden="true">${c.emoji}</span>${c.label}`,
            values.category, 'option option-tile')).join('')}
        </div>
        <p id="category-error" class="field-error" hidden></p>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary btn--block btn--lg">${icon('check-circle')}<span>Guardar egreso</span></button>
        ${mode === 'edit'
          ? `<button type="button" class="btn btn--danger-ghost btn--block" data-action="delete">${icon('trash')}Eliminar egreso</button>`
          : ''}
        <a class="btn btn--text btn--block" href="${exitTo}">${mode === 'voice' ? 'Descartar' : 'Cancelar'}</a>
      </div>
    </form>`;

  const form = root.querySelector('form');
  const amountInput = form.elements.amount;
  const customDate = form.elements.customDate;

  const currentDate = () => {
    const choice = form.elements.dateChoice.value;
    if (choice === 'today') return today;
    if (choice === 'yesterday') return yesterday;
    return customDate.value;
  };

  const refreshHints = () => {
    const date = currentDate();
    root.querySelector('[data-slot="date-text"]').textContent = date ? formatDate(date) : '';
    const category = form.elements.category.value;
    const hint = root.querySelector('[data-slot="category-text"]');
    hint.textContent = category
      ? `${getCategory(category).emoji} ${getCategory(category).label}${mode === 'voice' ? ' · sugerida' : ''}`
      : '';
  };

  root.querySelector('.kind-switch')?.addEventListener('change', (event) => {
    if (event.target.value !== 'INCOME') return;
    const amount = parseAmountInput(amountInput.value);
    const edits = { amount: amount > 0 ? amount : null, date: currentDate() };
    if (onSwitchKind) onSwitchKind('INCOME', edits);
    else location.hash = '#/ingreso/nuevo';
  });

  form.addEventListener('change', (event) => {
    if (event.target.name === 'dateChoice') {
      customDate.hidden = event.target.value !== 'other';
      if (!customDate.hidden) customDate.focus();
    }
    clearError(form, event.target.name === 'dateChoice' || event.target.name === 'customDate' ? 'date' : event.target.name);
    refreshHints();
  });

  amountInput.addEventListener('blur', () => {
    const value = parseAmountInput(amountInput.value);
    if (value > 0) amountInput.value = formatAmountInput(value);
  });
  amountInput.addEventListener('input', () => clearError(form, 'amount'));

  let saving = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return; // un segundo toque mientras se guarda no crea otro gasto
    const payload = readForm(form, currentDate(), values);
    if (!payload) return;
    saving = true;

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.querySelector('span').textContent = 'Guardando…';
    form.querySelector('.form-alert').hidden = true;
    try {
      if (mode === 'edit') await api.updateExpense(id, payload);
      else await api.createExpense(payload);
      setPreferredPaymentMethod(payload.paymentMethod);
      onSaved?.();
      showToast(mode === 'edit' ? 'Cambios guardados' : `Egreso de ${formatMoney(payload.amount)} guardado`);
      location.hash = exitTo;
    } catch (error) {
      // Los datos quedan en el formulario: no se pierde nada si falla la conexión.
      showServerErrors(form, error);
      saving = false;
      button.disabled = false;
      button.querySelector('span').textContent = 'Guardar egreso';
    }
  });

  form.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '¿Eliminar este egreso?',
      message: `${values.description} · ${formatMoney(values.amount)}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteExpense(id);
      showToast('Egreso eliminado');
      location.hash = exitTo;
    } catch (error) {
      showServerErrors(form, error);
    }
  });

  refreshHints();
  if (mode === 'voice' && !values.amount) amountInput.focus();
}

/** Selector Egreso / Ingreso al cargar un movimiento nuevo. */
export function kindSwitch(selected) {
  return `
    <div class="segmented kind-switch" role="radiogroup" aria-label="Tipo de movimiento">
      <label class="segment segment--expense"><input type="radio" name="kind" value="EXPENSE" ${selected === 'EXPENSE' ? 'checked' : ''}><span>− Egreso</span></label>
      <label class="segment segment--income"><input type="radio" name="kind" value="INCOME" ${selected === 'INCOME' ? 'checked' : ''}><span>+ Ingreso</span></label>
    </div>`;
}

function radio(name, value, labelHtml, selected, className = 'segment') {
  return `
    <label class="${className}">
      <input type="radio" name="${name}" value="${value}" ${value === selected ? 'checked' : ''}>
      <span>${labelHtml}</span>
    </label>`;
}

/** Valida en el navegador. Devuelve el objeto para la API, o null si hay errores. */
function readForm(form, date, original) {
  const errors = {};
  const amount = parseAmountInput(form.elements.amount.value);
  if (!(amount > 0)) errors.amount = 'Ingresá un importe mayor a cero (ej. 18.000).';
  else if (amount > MAX_AMOUNT) errors.amount = 'El importe es demasiado grande.';

  const category = form.elements.category.value;
  if (!category) errors.category = 'Elegí una categoría.';

  if (!date) errors.date = 'Elegí una fecha.';
  else if (date > todayISO()) errors.date = 'La fecha no puede ser futura.';

  const paymentMethod = form.elements.paymentMethod.value;
  if (!paymentMethod) errors.paymentMethod = 'Elegí la forma de pago.';

  if (Object.keys(errors).length) {
    showFieldErrors(form, errors);
    return null;
  }

  // Descripción vacía: usamos el nombre de la categoría para no frenar la carga.
  const description = form.elements.description.value.trim() || getCategory(category).label;
  return {
    amount,
    description,
    date,
    category,
    paymentMethod,
    source: original.source ?? 'MANUAL',
    voiceTranscript: original.voiceTranscript ?? null,
  };
}

function showFieldErrors(form, errors) {
  let first = null;
  for (const [field, message] of Object.entries(errors)) {
    const el = form.querySelector(`#${field}-error`);
    if (!el) continue;
    el.textContent = message;
    el.hidden = false;
    first ??= el;
  }
  if (first) {
    first.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    first.closest('.card')?.querySelector('input:not([type="radio"]), input:checked, input')?.focus({ preventScroll: true });
  }
}

function showServerErrors(form, error) {
  const alert = form.querySelector('.form-alert');
  alert.textContent = error.message;
  alert.hidden = false;
  if (error.errors && Object.keys(error.errors).length) showFieldErrors(form, error.errors);
  else alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearError(form, field) {
  const el = form.querySelector(`#${field}-error`);
  if (el) el.hidden = true;
}
