// Gastos fijos (#/fijos): la configuración de cada gasto mensual y su situación.
import { api } from '../api.js';
import { getCategory } from '../categories.js';
import { formatDate, formatMoney, formatMonth } from '../format.js';
import { categoryBubble, errorState, escapeHtml, icon, loadingState, topBar } from '../ui.js';

export const RECURRING_STATES = {
  ACTIVE: { label: 'Activo', css: 'tag--ok' },
  PAUSED: { label: 'Pausado', css: 'tag--pending' },
  SCHEDULED: { label: 'Programado', css: '' },
  FINISHED: { label: 'Finalizado', css: '' },
};

export function renderRecurring(root) {
  root.innerHTML = `
    ${topBar('Gastos fijos', { back: '#/plan' })}
    <p class="muted small">Configurá una vez cada gasto mensual. La app prepara el pago de cada mes; vos lo marcás como pagado.</p>
    <a class="btn btn--primary btn--block" href="#/fijo/nuevo">${icon('plus-circle')}Nuevo gasto fijo</a>
    <div data-slot="list">${loadingState()}</div>`;

  const list = root.querySelector('[data-slot="list"]');
  const load = async () => {
    list.innerHTML = loadingState();
    try {
      const items = await api.listRecurring();
      list.innerHTML = items.length === 0
        ? `<div class="empty-card">
             <p class="empty-text">Todavía no tenés gastos fijos.</p>
             <p class="muted small">Por ejemplo: alquiler, expensas, internet, gimnasio o suscripciones.</p>
           </div>`
        : `<ul class="expense-list">${items.map(row).join('')}</ul>`;
    } catch (error) {
      list.innerHTML = errorState(error.message);
    }
  };
  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="retry"]')) load();
  });
  load();
}

function row(r) {
  const state = RECURRING_STATES[r.state];
  const c = getCategory(r.category);
  const when = r.state === 'FINISHED'
    ? `Terminó en ${formatMonth(r.endMonth).toLowerCase()}`
    : r.nextDueDate ? `Próximo vencimiento: ${formatDate(r.nextDueDate)}` : `Vence el día ${r.dueDay}`;
  return `
    <li>
      <a class="expense-row expense-row--detailed" href="#/fijo/${r.id}">
        ${categoryBubble(r.category, 'category-bubble--lg')}
        <span class="expense-row__main">
          <span class="expense-row__title">${escapeHtml(r.description)}</span>
          <span class="expense-row__sub">${c.label} · ${when}</span>
          ${r.overdueCount > 0 ? `<span class="tag tag--danger">${icon('alert')}${r.overdueCount} ${r.overdueCount === 1 ? 'mes vencido' : 'meses vencidos'}</span>` : ''}
        </span>
        <span class="expense-row__end">
          <span class="amount">${formatMoney(r.amount)}</span>
          <span class="tag ${state.css}">${state.label}</span>
        </span>
      </a>
    </li>`;
}
