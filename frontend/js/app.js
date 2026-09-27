// Punto de entrada: navegación entre pantallas según el "#" de la URL.
//   #/inicio · #/movimientos · #/nuevo · #/voz · #/confirmar · #/gasto/12 · #/graficos · #/ajustes
import { setupPwa } from './install.js';
import { renderExpenseForm } from './screens/expense-form.js';
import { renderHome } from './screens/home.js';
import { renderMovements } from './screens/movements.js';
import { renderSettings } from './screens/settings.js';
import { renderStatistics } from './screens/statistics.js';
import { renderVoice } from './screens/voice.js';

const ROUTES = [
  { pattern: /^inicio$/, nav: 'inicio', render: renderHome },
  { pattern: /^movimientos$/, nav: 'movimientos', render: renderMovements },
  { pattern: /^graficos$/, nav: 'graficos', render: renderStatistics },
  { pattern: /^ajustes$/, nav: 'ajustes', render: renderSettings },
  { pattern: /^nuevo$/, render: (root) => renderExpenseForm(root, { mode: 'new' }) },
  { pattern: /^confirmar$/, render: (root) => renderExpenseForm(root, { mode: 'voice' }) },
  { pattern: /^gasto\/(\d+)$/, render: (root, [id]) => renderExpenseForm(root, { mode: 'edit', id }) },
  { pattern: /^voz$/, render: renderVoice },
];

const app = document.getElementById('app');
const nav = document.querySelector('.bottom-nav');
let cleanup = null;

function navigate() {
  const path = location.hash.replace(/^#\/?/, '');
  const route = ROUTES.find((r) => r.pattern.test(path));
  if (!route) {
    location.replace('#/inicio');
    return;
  }

  if (typeof cleanup === 'function') cleanup();

  // Cada pantalla arranca con un contenedor nuevo (así no se acumulan listeners viejos).
  const screen = document.createElement('div');
  screen.className = 'screen';
  app.replaceChildren(screen);

  const params = path.match(route.pattern).slice(1);
  cleanup = route.render(screen, params);

  const hasNav = Boolean(route.nav);
  nav.hidden = !hasNav;
  document.body.classList.toggle('has-nav', hasNav);
  nav.querySelectorAll('a[data-nav]').forEach((link) => {
    if (link.dataset.nav === route.nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  window.scrollTo(0, 0);
  screen.querySelector('.topbar__title')?.focus({ preventScroll: true });
}

function watchConnection() {
  const banner = document.getElementById('offline-banner');
  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

window.addEventListener('hashchange', navigate);
watchConnection();
setupPwa();
navigate();
