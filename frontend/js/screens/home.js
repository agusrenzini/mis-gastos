// Pantalla Inicio: resumen del mes actual (ingresos, egresos, balance) y carga rápida
// ("Agregar movimiento" o por voz). Más abajo, egresos por categoría y los últimos movimientos.
import { api } from '../api.js';
import { categoryLegend, donutChart, groupCategories } from '../charts.js';
import { monthOf, todayISO } from '../dates.js';
import { formatMoney, formatMoneyShort, formatMonth } from '../format.js';
import { changeBadge, errorState, expenseRow, icon, loadingState, topBar } from '../ui.js';

export function renderHome(root) {
  const month = monthOf(todayISO());

  root.innerHTML = `
    ${topBar('Inicio')}
    <section class="greeting">
      <h2 class="greeting__title">Hola 👋</h2>
      <p class="greeting__date">${icon('calendar')}${formatMonth(month)}</p>
    </section>
    <div data-slot="summary">${loadingState()}</div>
    <section class="quick-add" aria-label="Carga rápida">
      <a class="btn btn--primary btn--block btn--lg" href="#/agregar">${icon('plus-circle')}Agregar movimiento</a>
      <a class="voice-cta" href="#/voz">
        <span class="voice-cta__mic">${icon('mic')}</span>
        <span>Registrar por voz</span>
        <span class="voice-cta__wave" aria-hidden="true"><i></i><i></i><i></i></span>
      </a>
    </section>
    <div data-slot="details"></div>`;

  const load = async () => {
    const summary = root.querySelector('[data-slot="summary"]');
    const details = root.querySelector('[data-slot="details"]');
    summary.innerHTML = loadingState();
    details.innerHTML = '';
    try {
      const [data, budget] = await Promise.all([api.getDashboard(month), api.getBudget(month)]);
      summary.innerHTML = summaryCard(data, budget.summary);
      details.innerHTML = categoriesCard(data) + recentList(data.recent);
    } catch (error) {
      summary.innerHTML = errorState(error.message);
    }
  };

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="retry"]')) load();
  });
  load();
}

function summaryCard(data, s) {
  const balance = Number(s.registeredBalance);
  const expected = Number(s.incomeExpectedPending);
  const pending = Number(s.pendingRecurring);
  return `
    <section class="card summary-card" aria-labelledby="summary-title">
      <div class="summary-card__head">
        <h2 id="summary-title" class="overline"><span class="dot dot--primary" aria-hidden="true"></span>Este mes</h2>
        ${changeBadge(data.changePercent, 'egresos vs mes anterior')}
      </div>
      <div class="month-totals">
        <div class="month-totals__item">
          <span class="mini-stat__label">${icon('income')}Ingresos recibidos</span>
          <span class="month-totals__value amount amount--income">+${formatMoney(s.incomeReceived)}</span>
        </div>
        <div class="month-totals__item">
          <span class="mini-stat__label">${icon('receipt')}Egresos</span>
          <span class="month-totals__value amount">−${formatMoney(data.total)}</span>
        </div>
      </div>
      <p class="month-balance">Balance del mes
        <strong class="amount ${balance < 0 ? 'is-negative' : ''}">${balance > 0 ? '+' : ''}${formatMoney(balance)}</strong></p>
      ${expected > 0 || pending > 0 ? `
        <p class="muted small">${[
          expected > 0 ? `${formatMoney(expected)} en ingresos esperados (todavía no cobrados)` : '',
          pending > 0 ? `${formatMoney(pending)} en gastos fijos pendientes` : '',
        ].filter(Boolean).join(' · ')}.</p>` : ''}
      <div class="summary-card__minis">
        <div class="mini-stat">
          <span class="mini-stat__label">${icon('calendar')}Egresos de la semana</span>
          <span class="mini-stat__value amount">${formatMoney(data.weekTotal)}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat__label">${icon('clock')}Promedio diario</span>
          <span class="mini-stat__value amount">${formatMoney(Math.round(data.dailyAverage))}</span>
        </div>
      </div>
    </section>`;
}

function categoriesCard(data) {
  if (data.byCategory.length === 0) {
    return `
      <section class="card">
        <h2 class="card__title">${icon('pie')}Egresos por categoría</h2>
        <p class="empty-text">Todavía no registraste egresos este mes. Tocá “Agregar movimiento” o usá el micrófono.</p>
      </section>`;
  }
  const slices = groupCategories(data.byCategory);
  return `
    <section class="card" aria-labelledby="categories-title">
      <div class="card__head">
        <h2 id="categories-title" class="card__title">${icon('pie')}Egresos por categoría</h2>
        <a class="link" href="#/graficos">Gráficos${icon('chevron-right')}</a>
      </div>
      ${donutChart(slices, { centerValue: formatMoneyShort(data.total), centerNote: '100%' })}
      ${categoryLegend(slices)}
    </section>`;
}

function recentList(recent) {
  if (recent.length === 0) return '';
  return `
    <section aria-labelledby="recent-title">
      <div class="section-head">
        <h2 id="recent-title" class="section-title">Últimos egresos</h2>
        <a class="link" href="#/movimientos">Ver todos${icon('chevron-right')}</a>
      </div>
      <ul class="expense-list">${recent.map((e) => expenseRow(e)).join('')}</ul>
    </section>`;
}
