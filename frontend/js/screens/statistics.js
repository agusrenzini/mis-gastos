// Pantalla Gráficos: total, comparación, evolución y categorías para semana, mes o año.
import { api } from '../api.js';
import { barChart, categoryBars, donutChart, groupCategories } from '../charts.js';
import { getCategory } from '../categories.js';
import { addDays, parseISODate, todayISO } from '../dates.js';
import { MONTHS, MONTHS_SHORT, formatMoney, formatMoneyShort, formatPercent } from '../format.js';
import { errorState, icon, loadingState, topBar } from '../ui.js';

const PERIODS = [
  { key: 'WEEK', label: 'Semana' },
  { key: 'MONTH', label: 'Mes' },
  { key: 'YEAR', label: 'Año' },
];
const WEEK_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Se conserva al cambiar de pantalla y volver.
const view = { period: 'MONTH', date: todayISO() };

export function renderStatistics(root) {
  root.innerHTML = `
    ${topBar('Gráficos', { back: '#/movimientos' })}
    <div class="segmented segmented--tabs" role="group" aria-label="Período">
      ${PERIODS.map((p) => `
        <button type="button" class="segment-button" data-action="period" data-period="${p.key}"
                aria-pressed="${view.period === p.key}">${p.label}</button>`).join('')}
    </div>
    <div data-slot="content">${loadingState()}</div>`;

  const content = root.querySelector('[data-slot="content"]');

  const load = async () => {
    root.querySelectorAll('[data-action="period"]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.period === view.period)));
    content.innerHTML = loadingState();
    try {
      const stats = await api.getStatistics(view.period, view.date);
      content.innerHTML = render(stats);
    } catch (error) {
      content.innerHTML = errorState(error.message);
    }
  };

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'retry') load();
    if (action === 'period') {
      view.period = target.dataset.period;
      view.date = todayISO();
      load();
    }
    if (action === 'prev' || action === 'next') {
      view.date = shift(view.period, view.date, action === 'prev' ? -1 : 1);
      load();
    }
  });

  load();
}

function shift(period, iso, direction) {
  if (period === 'WEEK') return addDays(iso, 7 * direction);
  const d = parseISODate(iso);
  if (period === 'MONTH') return isoOf(new Date(d.getFullYear(), d.getMonth() + direction, 1));
  return isoOf(new Date(d.getFullYear() + direction, 0, 1));
}

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function periodTitle(stats) {
  const from = parseISODate(stats.from);
  const to = parseISODate(stats.to);
  if (stats.period === 'YEAR') return String(from.getFullYear());
  if (stats.period === 'MONTH') return `${MONTHS[from.getMonth()]} ${from.getFullYear()}`;
  const sameMonth = from.getMonth() === to.getMonth();
  return `${from.getDate()}${sameMonth ? '' : ` ${MONTHS_SHORT[from.getMonth()]}`}–${to.getDate()} ${MONTHS_SHORT[to.getMonth()]} ${to.getFullYear()}`;
}

function headline(stats, isCurrent) {
  const names = { WEEK: ['Esta semana', 'la semana pasada'], MONTH: ['Este mes', 'el mes pasado'], YEAR: ['Este año', 'el año pasado'] };
  const [current, previous] = names[stats.period];
  const subject = isCurrent ? current : `En ${periodTitle(stats)}`;
  let comparison;
  if (stats.changePercent == null) {
    comparison = 'Sin gastos en el período anterior para comparar.';
  } else {
    const value = Number(stats.changePercent);
    const prevLabel = isCurrent ? previous : 'el período anterior';
    comparison = value === 0
      ? `Igual que ${prevLabel}.`
      : `${formatPercent(Math.abs(value))} ${value > 0 ? 'más' : 'menos'} que ${prevLabel}.`;
  }
  return { subject, comparison, up: Number(stats.changePercent) > 0 };
}

function timelinePoints(stats) {
  const today = todayISO();
  return stats.timeline.map((p, i) => {
    const start = parseISODate(p.start);
    const label = stats.period === 'WEEK' ? WEEK_LETTERS[i]
      : stats.period === 'YEAR' ? MONTHS_SHORT[start.getMonth()].charAt(0)
        : String(start.getDate());
    const highlight = today >= p.start && today <= p.end;
    const title = stats.period === 'YEAR'
      ? `${MONTHS[start.getMonth()]}: ${formatMoney(p.total)}`
      : `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}: ${formatMoney(p.total)}`;
    return { label, value: Number(p.total), highlight, title };
  });
}

function render(stats) {
  const today = todayISO();
  const isCurrent = today >= stats.from && today <= stats.to;
  const { subject, comparison, up } = headline(stats, isCurrent);
  const top = stats.topCategory;

  return `
    <div class="period-nav">
      <button type="button" class="icon-button icon-button--soft" data-action="prev" aria-label="Período anterior">${icon('chevron-left')}</button>
      <span class="pill pill--lg">${icon('calendar')}${periodTitle(stats)}</span>
      <button type="button" class="icon-button icon-button--soft" data-action="next" aria-label="Período siguiente" ${isCurrent ? 'disabled' : ''}>${icon('chevron-right')}</button>
    </div>

    <section class="card summary-card">
      <p class="muted">${subject} gastaste</p>
      <p class="summary-card__total"><span class="amount">${formatMoney(stats.total)}</span><small>ARS</small></p>
      <p class="comparison ${stats.changePercent == null ? '' : up ? 'comparison--up' : 'comparison--down'}">
        ${stats.changePercent == null ? '' : icon(up ? 'trend-up' : 'trend-down')}${comparison}
      </p>
      <div class="summary-card__minis">
        <div class="mini-stat">
          <span class="mini-stat__label">${icon('clock')}Promedio diario</span>
          <span class="mini-stat__value amount">${formatMoney(Math.round(stats.dailyAverage))}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat__label">${icon('list')}Movimientos</span>
          <span class="mini-stat__value amount">${stats.expenseCount}</span>
        </div>
      </div>
    </section>

    ${top ? `
      <section class="card insight-card">
        <span class="category-bubble" style="--cat-bg:${getCategory(top.category).bg}" aria-hidden="true">🏆</span>
        <p>Tu mayor gasto fue en <strong>${getCategory(top.category).emoji} ${getCategory(top.category).label}</strong>:
          <span class="amount">${formatMoney(top.total)}</span> (${formatPercent(top.percent)} del total).</p>
      </section>` : ''}

    <section class="card">
      <h2 class="card__title">${icon('bars')}Evolución</h2>
      ${barChart(timelinePoints(stats), { labelEvery: stats.period === 'MONTH' ? 5 : 1 })}
    </section>

    <section class="card">
      <h2 class="card__title">${icon('pie')}Por categoría</h2>
      ${stats.byCategory.length === 0
        ? '<p class="empty-text">No hay gastos en este período.</p>'
        : donutChart(groupCategories(stats.byCategory), { centerValue: formatMoneyShort(stats.total) })
          + categoryBars(stats.byCategory)}
    </section>`;
}
