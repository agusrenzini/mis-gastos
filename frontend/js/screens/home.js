// Pantalla Inicio: resumen del mes, acceso a voz, donut por categoría y últimos gastos.
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
    <a class="voice-cta" href="#/voz">
      <span class="voice-cta__mic">${icon('mic')}</span>
      <span>Registrar gasto por voz</span>
      <span class="voice-cta__wave" aria-hidden="true"><i></i><i></i><i></i></span>
    </a>
    <a class="btn btn--outline btn--block manual-cta" href="#/nuevo">${icon('plus-circle')}Registrar manualmente</a>
    <div data-slot="details"></div>`;

  const load = async () => {
    const summary = root.querySelector('[data-slot="summary"]');
    const details = root.querySelector('[data-slot="details"]');
    summary.innerHTML = loadingState();
    details.innerHTML = '';
    try {
      const data = await api.getDashboard(month);
      summary.innerHTML = summaryCard(data);
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

function summaryCard(data) {
  return `
    <section class="card summary-card" aria-labelledby="summary-title">
      <div class="summary-card__head">
        <h2 id="summary-title" class="overline"><span class="dot dot--primary" aria-hidden="true"></span>Gastado este mes</h2>
        ${changeBadge(data.changePercent, 'vs mes anterior')}
      </div>
      <p class="summary-card__total"><span class="amount">${formatMoney(data.total)}</span><small>ARS</small></p>
      <div class="summary-card__minis">
        <div class="mini-stat">
          <span class="mini-stat__label">${icon('calendar')}Esta semana</span>
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
        <h2 class="card__title">${icon('pie')}Gastos por categoría</h2>
        <p class="empty-text">Todavía no registraste gastos este mes. ¡Empezá con el micrófono!</p>
      </section>`;
  }
  const slices = groupCategories(data.byCategory);
  return `
    <section class="card" aria-labelledby="categories-title">
      <div class="card__head">
        <h2 id="categories-title" class="card__title">${icon('pie')}Gastos por categoría</h2>
        <span class="pill">${slices.length} ${slices.length === 1 ? 'rubro' : 'rubros'}</span>
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
        <h2 id="recent-title" class="section-title">Últimos gastos</h2>
        <a class="link" href="#/movimientos">Ver todos${icon('chevron-right')}</a>
      </div>
      <ul class="expense-list">${recent.map((e) => expenseRow(e)).join('')}</ul>
    </section>`;
}
