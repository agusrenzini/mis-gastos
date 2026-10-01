// Un mes de un gasto fijo (#/obligacion/7): pagar, vincular un gasto ya cargado, ajustar el importe u omitirlo.
import { api } from '../api.js';
import { PAYMENT_METHODS, getCategory } from '../categories.js';
import { todayISO } from '../dates.js';
import { formatAmountInput, formatDate, formatMoney, formatMonth, parseAmountInput } from '../format.js';
import { getPreferredPaymentMethod, setPreferredPaymentMethod } from '../state.js';
import { categoryBubble, confirmDialog, errorState, escapeHtml, icon, loadingState, showToast, topBar } from '../ui.js';
import { hideError, showErrors } from './income-form.js';

const BACK = '#/plan';

export function renderObligation(root, [id]) {
  const load = async () => {
    root.innerHTML = topBar('Gasto fijo', { back: BACK }) + loadingState();
    try {
      const obligation = await api.getObligation(id);
      mount(root, obligation, load);
    } catch (error) {
      root.innerHTML = topBar('Gasto fijo', { back: BACK }) + errorState(error.message);
      root.querySelector('[data-action="retry"]')?.addEventListener('click', load);
    }
  };
  load();
}

function mount(root, o, reload) {
  const c = getCategory(o.category);
  const statusText = o.status === 'PAID' ? 'Pagado' : o.status === 'SKIPPED' ? 'Omitido' : o.overdue ? 'Vencido' : 'Pendiente';
  const statusCss = o.status === 'PAID' ? 'tag--ok' : o.status === 'SKIPPED' ? '' : o.overdue ? 'tag--danger' : 'tag--pending';

  root.innerHTML = `
    ${topBar(o.description, { back: BACK })}
    <section class="card obligation-head">
      ${categoryBubble(o.category, 'category-bubble--lg')}
      <div>
        <p class="obligation-head__title">${escapeHtml(o.description)} · ${formatMonth(o.month)}</p>
        <p class="muted small">${c.label} · vence el ${formatDate(o.dueDate)}</p>
        <span class="tag ${statusCss}">${statusText}</span>
      </div>
      <p class="obligation-head__amount amount">${formatMoney(o.status === 'PAID' ? o.paidAmount : o.amount)}</p>
    </section>
    <div class="form-alert" role="alert" hidden></div>
    ${o.status === 'PENDING' ? pendingSections(o) : ''}
    ${o.status === 'PAID' ? paidSection(o) : ''}
    ${o.status === 'SKIPPED' ? `
      <section class="card">
        <p class="muted small">Este mes no se paga y no cuenta como pendiente en el presupuesto.</p>
        <button type="button" class="btn btn--soft btn--block" data-action="restore">Restaurar como pendiente</button>
      </section>` : ''}`;

  const alertBox = root.querySelector('.form-alert');
  const fail = (error) => {
    alertBox.textContent = error.message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (o.status === 'PENDING') wirePending(root, o, reload, fail);

  root.querySelector('[data-action="unpay"]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '¿Deshacer el pago?',
      message: o.expenseCreated
        ? 'El mes vuelve a quedar pendiente y se elimina el gasto que se registró al pagarlo.'
        : 'El mes vuelve a quedar pendiente. El gasto vinculado no se borra.',
      confirmLabel: 'Deshacer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.unpayObligation(o.id);
      showToast('El mes volvió a quedar pendiente');
      reload();
    } catch (error) {
      fail(error);
    }
  });

  root.querySelector('[data-action="restore"]')?.addEventListener('click', async () => {
    try {
      await api.restoreObligation(o.id);
      showToast('El mes volvió a quedar pendiente');
      reload();
    } catch (error) {
      fail(error);
    }
  });
}

function pendingSections(o) {
  const today = todayISO();
  const preferred = getPreferredPaymentMethod();
  return `
    <form class="card pay-form" novalidate>
      <h2 class="card__title">${icon('check-circle')}Registrar el pago</h2>
      <p class="muted small">Se guarda como un gasto real de ${getCategory(o.category).label}. No hace falta cargarlo aparte.</p>
      <label class="field-label" for="amount">Importe pagado</label>
      <span class="budget-input__field">
        <span aria-hidden="true">$</span>
        <input id="amount" name="amount" class="input amount" inputmode="decimal" autocomplete="off"
               value="${formatAmountInput(o.amount)}" aria-describedby="amount-error">
      </span>
      <p id="amount-error" class="field-error" hidden></p>
      <label class="field-label" for="date">Fecha de pago</label>
      <input id="date" name="date" type="date" class="input" max="${today}" value="${o.dueDate < today ? o.dueDate : today}" aria-describedby="date-error">
      <p id="date-error" class="field-error" hidden></p>
      <span id="payment-label" class="field-label">Forma de pago</span>
      <div class="option-grid option-grid--2" role="radiogroup" aria-labelledby="payment-label">
        ${PAYMENT_METHODS.map((p) => `
          <label class="option">
            <input type="radio" name="paymentMethod" value="${p.key}" ${p.key === preferred ? 'checked' : ''}>
            <span>${icon(p.icon)}${p.label}</span>
          </label>`).join('')}
      </div>
      <p id="paymentMethod-error" class="field-error" hidden></p>
      <button type="submit" class="btn btn--primary btn--block btn--lg">${icon('check-circle')}<span>Marcar como pagado</span></button>
    </form>

    <section class="card">
      <h2 class="card__title">${icon('link')}¿Ya lo cargaste como gasto?</h2>
      <p class="muted small">Vinculalo para no contarlo dos veces.</p>
      <div data-slot="candidates">${loadingState('Buscando gastos…')}</div>
    </section>

    <section class="card">
      <h2 class="card__title">${icon('sliders')}Otras opciones</h2>
      <form class="adjust-form" novalidate>
        <label class="field-label" for="adjust">Ajustar el importe de este mes</label>
        <div class="adjust-form__row">
          <span class="budget-input__field">
            <span aria-hidden="true">$</span>
            <input id="adjust" name="adjust" class="input amount" inputmode="decimal" autocomplete="off"
                   value="${formatAmountInput(o.amount)}" aria-describedby="adjust-error">
          </span>
          <button type="submit" class="btn btn--soft">Guardar</button>
        </div>
        <p id="adjust-error" class="field-error" hidden></p>
        <p class="field-hint">Solo cambia este mes${o.amountAdjusted ? ' (ya fue ajustado)' : ''}. Los demás siguen con el importe previsto.</p>
      </form>
      <button type="button" class="btn btn--text btn--block" data-action="skip">Omitir este mes (no se paga)</button>
    </section>`;
}

function paidSection(o) {
  return `
    <section class="card">
      <p>${icon('check-circle', 'icon--ok')} Pagado el <strong>${formatDate(o.paidDate)}</strong> por <strong class="amount">${formatMoney(o.paidAmount)}</strong>.</p>
      <p class="muted small">${o.expenseCreated ? 'El pago se registró como gasto.' : 'Se vinculó con un gasto que ya estaba cargado.'}
        Ya cuenta en gastos reales y no como pendiente.</p>
      <a class="btn btn--outline btn--block" href="#/gasto/${o.expenseId}">Ver el gasto</a>
      <button type="button" class="btn btn--text btn--block" data-action="unpay">Deshacer el pago</button>
    </section>`;
}

function wirePending(root, o, reload, fail) {
  // Pagar
  const payForm = root.querySelector('.pay-form');
  payForm.addEventListener('input', (event) => hideError(payForm, event.target.name));
  payForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const amount = parseAmountInput(payForm.elements.amount.value);
    const date = payForm.elements.date.value;
    const paymentMethod = payForm.elements.paymentMethod.value;
    const errors = {};
    if (!(amount > 0)) errors.amount = 'Ingresá el importe pagado.';
    if (!date) errors.date = 'Elegí la fecha de pago.';
    else if (date > todayISO()) errors.date = 'La fecha no puede ser futura.';
    if (!paymentMethod) errors.paymentMethod = 'Elegí la forma de pago.';
    if (Object.keys(errors).length) {
      showErrors(payForm, { errors });
      return;
    }
    const button = payForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api.payObligation(o.id, { amount, date, paymentMethod });
      setPreferredPaymentMethod(paymentMethod);
      showToast(`Pago de ${formatMoney(amount)} registrado`);
      location.hash = BACK;
    } catch (error) {
      button.disabled = false;
      if (error.errors && Object.keys(error.errors).length) showErrors(payForm, error);
      else fail(error);
    }
  });

  // Vincular un gasto existente
  const slot = root.querySelector('[data-slot="candidates"]');
  api.obligationCandidates(o.id)
    .then((expenses) => {
      if (expenses.length === 0) {
        slot.innerHTML = '<p class="empty-text">No hay gastos sin vincular cerca de este mes.</p>';
        return;
      }
      slot.innerHTML = `<ul class="candidate-list">${expenses.map((e) => `
        <li class="candidate">
          ${categoryBubble(e.category)}
          <span class="expense-row__main">
            <span class="expense-row__title">${escapeHtml(e.description)}</span>
            <span class="expense-row__sub">${formatDate(e.date)} · ${getCategory(e.category).label}</span>
          </span>
          <span class="amount">${formatMoney(e.amount)}</span>
          <button type="button" class="btn btn--small btn--ghost" data-action="link" data-id="${e.id}"
                  data-label="${escapeHtml(e.description)} · ${formatMoney(e.amount)}">${icon('link')}Vincular</button>
        </li>`).join('')}</ul>`;
    })
    .catch((error) => { slot.innerHTML = `<p class="empty-text">${escapeHtml(error.message)}</p>`; });

  slot.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="link"]');
    if (!button) return;
    const ok = await confirmDialog({
      title: '¿Vincular este gasto?',
      message: `${button.dataset.label} queda como el pago de ${o.description} de ${formatMonth(o.month).toLowerCase()}.`,
      confirmLabel: 'Vincular',
    });
    if (!ok) return;
    try {
      await api.linkObligation(o.id, Number(button.dataset.id));
      showToast('Gasto vinculado: el mes quedó pagado');
      location.hash = BACK;
    } catch (error) {
      fail(error);
    }
  });

  // Ajustar importe
  const adjustForm = root.querySelector('.adjust-form');
  adjustForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const amount = parseAmountInput(adjustForm.elements.adjust.value);
    if (!(amount > 0)) {
      showErrors(adjustForm, { errors: { adjust: 'Ingresá un importe mayor a cero.' } });
      return;
    }
    try {
      await api.adjustObligation(o.id, amount);
      showToast('Importe del mes actualizado');
      reload();
    } catch (error) {
      fail(error);
    }
  });

  // Omitir
  root.querySelector('[data-action="skip"]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '¿Omitir este mes?',
      message: `${o.description} de ${formatMonth(o.month).toLowerCase()} no se paga y deja de contar como pendiente. Podés restaurarlo.`,
      confirmLabel: 'Omitir',
    });
    if (!ok) return;
    try {
      await api.skipObligation(o.id);
      showToast('Mes omitido');
      location.hash = BACK;
    } catch (error) {
      fail(error);
    }
  });
}
