// Confirmación de un movimiento dictado (#/confirmar). Nada se guarda sin pasar por acá.
//  - Si el parser no pudo saber si es ingreso o egreso, se le pide a la persona que elija.
//  - Después se muestra el formulario correspondiente, prellenado y editable.
//  - El selector Egreso / Ingreso permite cambiar de tipo sin perder el monto ni la fecha.
import { getCategory } from '../categories.js';
import { formatDate, formatMoney } from '../format.js';
import { getPreferredPaymentMethod, takeVoiceDraft } from '../state.js';
import { escapeHtml, icon, topBar } from '../ui.js';
import { renderExpenseForm } from './expense-form.js';
import { renderIncomeForm } from './income-form.js';

// Vive en memoria: si se recarga la página se pierde (y eso está bien, nunca se guarda sin confirmar).
let pending = null;

export function renderVoiceConfirm(root) {
  const draft = takeVoiceDraft();
  if (draft) pending = draft;
  if (!pending) {
    location.replace('#/voz');
    return;
  }

  const done = () => { pending = null; };
  const switchTo = (kind, edits = {}) => {
    if (edits.amount != null) pending.amount = edits.amount;
    if (edits.date) pending.date = edits.date;
    show(kind);
  };

  const show = (kind) => {
    pending.kind = kind;
    if (kind === 'EXPENSE') {
      renderExpenseForm(root, {
        mode: 'voice',
        draft: {
          amount: pending.amount,
          description: pending.expense.description,
          date: pending.date,
          category: pending.expense.category,
          paymentMethod: pending.expense.paymentMethod ?? getPreferredPaymentMethod(),
          transcript: pending.transcript,
        },
        onSwitchKind: switchTo,
        onSaved: done,
      });
    } else if (kind === 'INCOME') {
      renderIncomeForm(root, {
        voice: {
          description: pending.income.description,
          amount: pending.amount,
          date: pending.date,
          type: pending.income.type,
          status: pending.income.status,
          transcript: pending.transcript,
        },
        onSwitchKind: switchTo,
        onSaved: done,
      });
    } else {
      chooser(root, pending, show);
    }
  };

  show(pending.kind);
}

/** No quedó claro el tipo: la persona elige antes de ver el formulario. */
function chooser(root, draft, show) {
  const category = getCategory(draft.expense.category);
  root.innerHTML = `
    ${topBar('Confirmar movimiento', { back: '#/voz' })}
    <section class="confirm-intro">
      <span class="pill pill--mint">Capturado por voz</span>
      <h2 class="confirm-intro__title">¿Es un ingreso o un egreso?</h2>
      <p class="transcript-pill">${icon('mic')}<q>${escapeHtml(draft.transcript)}</q></p>
      <p class="muted small">No quedó claro por la frase. Elegí uno y después vas a poder revisar todo antes de guardar.</p>
    </section>
    <div class="kind-choice">
      <button type="button" class="kind-tile kind-tile--expense" data-kind="EXPENSE">
        <span class="kind-tile__sign" aria-hidden="true">−</span>
        <span class="kind-tile__title">Egreso</span>
        <span class="kind-tile__hint">Gasto o pago${draft.expense.category !== 'OTROS' ? ` · ${category.emoji} ${category.label}` : ''}</span>
      </button>
      <button type="button" class="kind-tile kind-tile--income" data-kind="INCOME">
        <span class="kind-tile__sign" aria-hidden="true">+</span>
        <span class="kind-tile__title">Ingreso</span>
        <span class="kind-tile__hint">Sueldo, cobro o trabajo</span>
      </button>
    </div>
    <p class="muted small center">${draft.amount ? `Monto detectado: <strong class="amount">${formatMoney(draft.amount)}</strong> · ` : 'No detecté el monto: lo vas a completar en el paso siguiente · '}Fecha: ${formatDate(draft.date)}</p>
    <a class="btn btn--text btn--block" href="#/voz">Volver a dictar</a>`;

  root.querySelectorAll('[data-kind]').forEach((button) => {
    button.addEventListener('click', () => show(button.dataset.kind));
  });
}
