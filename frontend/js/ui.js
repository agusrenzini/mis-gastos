// Piezas de interfaz que usan varias pantallas.
import { getCategory, getPaymentMethod } from './categories.js';
import { formatMoney, formatRelativeDay, formatTime } from './format.js';

/** Escapa texto del usuario antes de meterlo en HTML (evita inyectar código). */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/** Ícono del sprite definido en index.html. */
export function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

export function topBar(title, { back = null, action = '' } = {}) {
  const left = back
    ? `<a class="icon-button" href="${back}" aria-label="Volver">${icon('arrow-left')}</a>`
    : `<span class="brand-mark" aria-hidden="true">${icon('wallet')}</span>`;
  return `
    <header class="topbar">
      ${left}
      <h1 class="topbar__title" tabindex="-1">${escapeHtml(title)}</h1>
      <div class="topbar__action">${action}</div>
    </header>`;
}

/** Selector de mes: ‹ Octubre 2026 ›. Las pantallas escuchan data-action="prev-month" / "next-month". */
export function monthNav(label, { nextDisabled = false } = {}) {
  return `
    <div class="month-card__nav">
      <button type="button" class="icon-button icon-button--soft" data-action="prev-month" aria-label="Mes anterior">${icon('chevron-left')}</button>
      <span class="pill pill--lg">${icon('calendar')}${escapeHtml(label)}</span>
      <button type="button" class="icon-button icon-button--soft" data-action="next-month" aria-label="Mes siguiente" ${nextDisabled ? 'disabled' : ''}>${icon('chevron-right')}</button>
    </div>`;
}

export function loadingState(text = 'Cargando…') {
  return `<div class="state-card" role="status"><span class="spinner" aria-hidden="true"></span>${text}</div>`;
}

export function errorState(message) {
  return `
    <div class="state-card state-card--error" role="alert">
      ${icon('cloud-off', 'state-card__icon')}
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn btn--ghost btn--small" data-action="retry">Reintentar</button>
    </div>`;
}

/** Badge de variación: gastar más se muestra en rojo suave, gastar menos en verde. */
export function changeBadge(changePercent, suffix = '') {
  if (changePercent == null) return '';
  const value = Number(changePercent);
  const up = value > 0;
  const text = `${up ? '+' : ''}${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
  return `
    <span class="change-badge ${up ? 'change-badge--up' : 'change-badge--down'}">
      ${icon(up ? 'trend-up' : 'trend-down')}${text}${suffix ? ` ${escapeHtml(suffix)}` : ''}
    </span>`;
}

export function categoryBubble(categoryKey, size = '') {
  const c = getCategory(categoryKey);
  return `<span class="category-bubble ${size}" style="--cat-bg:${c.bg}" aria-hidden="true">${c.emoji}</span>`;
}

/**
 * Fila de un gasto. variant "compact" (Inicio) o "detailed" (Movimientos).
 */
export function expenseRow(expense, variant = 'compact') {
  const c = getCategory(expense.category);
  const amount = `-${formatMoney(expense.amount)}`;
  const time = formatTime(expense.createdAt);
  const isVoice = expense.source === 'VOICE';

  if (variant === 'compact') {
    return `
      <li>
        <a class="expense-row" href="#/gasto/${expense.id}">
          ${categoryBubble(expense.category)}
          <span class="expense-row__main">
            <span class="expense-row__title">${escapeHtml(expense.description)}</span>
            <span class="expense-row__sub">${formatRelativeDay(expense.date)}${time ? `, ${time}` : ''}</span>
          </span>
          <span class="expense-row__end">
            <span class="amount">${amount}</span>
            <span class="expense-row__sub">${c.label}</span>
          </span>
        </a>
      </li>`;
  }

  const payment = getPaymentMethod(expense.paymentMethod);
  return `
    <li>
      <a class="expense-row expense-row--detailed ${isVoice ? 'expense-row--voice' : ''}" href="#/gasto/${expense.id}">
        ${categoryBubble(expense.category, 'category-bubble--lg')}
        <span class="expense-row__main">
          <span class="expense-row__title">
            ${escapeHtml(expense.description)}
            ${isVoice ? `<span class="tag tag--voice">${icon('mic')}Voz</span>` : ''}
          </span>
          <span class="expense-row__sub">${c.label}${time ? ` · ${time}` : ''}</span>
          <span class="tag">${icon(payment.icon)}${payment.label}</span>
        </span>
        <span class="amount amount--lg">${amount}</span>
      </a>
    </li>`;
}

// ---------- Avisos ----------

let toastTimer;

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('toast--visible'), 2800);
}

/** Pide confirmación con un diálogo nativo. Devuelve una promesa con true/false. */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false }) {
  const dialog = document.getElementById('confirm-dialog');
  dialog.querySelector('[data-slot="title"]').textContent = title;
  dialog.querySelector('[data-slot="message"]').textContent = message;
  const confirmButton = dialog.querySelector('[value="confirm"]');
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.toggle('btn--danger', danger);
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
  });
}
