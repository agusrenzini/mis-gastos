// Gráficos simples hechos a mano con SVG y HTML (sin librerías).
import { getCategory } from './categories.js';
import { escapeHtml } from './ui.js';
import { formatMoney, formatPercent } from './format.js';

/**
 * Agrupa las categorías para el donut: muestra las más grandes y junta el resto en "Otros".
 * byCategory viene ordenado de mayor a menor desde la API.
 */
export function groupCategories(byCategory, maxSlices = 6) {
  if (byCategory.length <= maxSlices) return byCategory;
  const top = byCategory.filter((c) => c.category !== 'OTROS').slice(0, maxSlices - 1);
  const rest = byCategory.filter((c) => !top.includes(c));
  const sum = (key) => rest.reduce((acc, c) => acc + Number(c[key]), 0);
  return [...top, { category: 'OTROS', total: sum('total'), percent: Math.round(sum('percent') * 10) / 10 }];
}

/**
 * Donut con un círculo por categoría. Usa un radio cuyo perímetro es 100,
 * así el largo de cada trazo es directamente su porcentaje.
 */
export function donutChart(slices, { centerLabel = 'Total', centerValue = '', centerNote = '' } = {}) {
  const R = 15.9155;
  const GAP = slices.length > 1 ? 1.2 : 0;
  let offset = 25; // arranca arriba (a las 12)
  const circles = slices.map((slice) => {
    const pct = Number(slice.percent);
    const length = Math.max(pct - GAP, 0.5);
    const circle = `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${getCategory(slice.category).color}"
      stroke-width="5" stroke-linecap="round" stroke-dasharray="${length} ${100 - length}"
      stroke-dashoffset="${offset}"></circle>`;
    offset -= pct;
    return circle;
  }).join('');

  const summary = slices
    .map((s) => `${getCategory(s.category).label} ${formatPercent(s.percent)}`)
    .join(', ');

  return `
    <figure class="donut" role="img" aria-label="Distribución por categoría: ${escapeHtml(summary)}">
      <svg viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="${R}" fill="none" stroke="var(--color-surface-container)" stroke-width="5"></circle>
        ${circles}
      </svg>
      <figcaption class="donut__center">
        <span class="donut__label">${escapeHtml(centerLabel)}</span>
        <span class="donut__value amount">${escapeHtml(centerValue)}</span>
        ${centerNote ? `<span class="donut__note">${escapeHtml(centerNote)}</span>` : ''}
      </figcaption>
    </figure>`;
}

/** Leyenda de categorías en dos columnas (como en Inicio de Stitch). */
export function categoryLegend(slices) {
  return `
    <ul class="category-legend">
      ${slices.map((s) => {
        const c = getCategory(s.category);
        return `
          <li class="category-legend__item">
            <span class="dot" style="background:${c.color}" aria-hidden="true"></span>
            <span class="category-legend__text">
              <span class="category-legend__name">${c.emoji} ${c.label}</span>
              <span class="category-legend__values">
                <span class="amount category-legend__amount">${formatMoney(s.total)}</span>
                <span class="category-legend__pct">${formatPercent(s.percent)}</span>
              </span>
            </span>
          </li>`;
      }).join('')}
    </ul>`;
}

/** Lista de categorías con barra de progreso (pantalla Gráficos). */
export function categoryBars(byCategory) {
  return `
    <ul class="category-bars">
      ${byCategory.map((s) => {
        const c = getCategory(s.category);
        return `
          <li class="category-bars__item">
            <div class="category-bars__head">
              <span>${c.emoji} ${c.label}</span>
              <span class="amount">${formatMoney(s.total)} <small>${formatPercent(s.percent)}</small></span>
            </div>
            <div class="progress" aria-hidden="true">
              <span style="width:${Math.max(Number(s.percent), 1)}%;background:${c.color}"></span>
            </div>
          </li>`;
      }).join('')}
    </ul>`;
}

/**
 * Gráfico de barras vertical.
 * points: [{ label, value, highlight, title }]; se muestran solo algunas etiquetas si hay muchas barras.
 */
export function barChart(points, { labelEvery = 1, ariaLabel = 'Evolución de gastos' } = {}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return `
    <figure class="bar-chart" role="img" aria-label="${escapeHtml(ariaLabel)}">
      <div class="bar-chart__bars" style="--bars:${points.length}">
        ${points.map((p, i) => `
          <div class="bar-chart__col ${p.highlight ? 'is-highlight' : ''}" title="${escapeHtml(p.title ?? '')}">
            <span class="bar-chart__bar" style="height:${p.value > 0 ? Math.max((p.value / max) * 100, 3) : 0}%"></span>
            <span class="bar-chart__label">${i % labelEvery === 0 || p.highlight ? escapeHtml(p.label) : ''}</span>
          </div>`).join('')}
      </div>
      <figcaption class="bar-chart__max">Máximo: <span class="amount">${formatMoney(max === 1 && points.every((p) => !p.value) ? 0 : max)}</span></figcaption>
    </figure>`;
}
