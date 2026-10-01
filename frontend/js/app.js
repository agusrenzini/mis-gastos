// Punto de entrada: navegación entre pantallas según el "#" de la URL.
//   #/inicio · #/movimientos · #/nuevo · #/voz · #/confirmar · #/gasto/12 · #/graficos · #/ajustes
//   #/ingresar · #/registro · #/contrasena · #/admin
//   #/ingresos · #/ingreso/nuevo · #/ingreso/5 · #/plan · #/presupuesto/2026-10 · #/fijos · #/fijo/3 · #/obligacion/7
// Antes de mostrar cualquier pantalla se consulta la sesión: sin sesión solo se puede ingresar o registrarse.
import { api } from './api.js';
import { setupPwa } from './install.js';
import { renderAdmin } from './screens/admin.js';
import { renderLogin, renderRegister } from './screens/auth.js';
import { renderBudgetForm } from './screens/budget-form.js';
import { renderChangePassword } from './screens/change-password.js';
import { renderIncomeForm } from './screens/income-form.js';
import { renderIncomes } from './screens/incomes.js';
import { renderObligation } from './screens/obligation.js';
import { renderPlan } from './screens/plan.js';
import { renderRecurringForm } from './screens/recurring-form.js';
import { renderRecurring } from './screens/recurring.js';
import { renderExpenseForm } from './screens/expense-form.js';
import { renderHome } from './screens/home.js';
import { renderMovements } from './screens/movements.js';
import { renderSettings } from './screens/settings.js';
import { renderStatistics } from './screens/statistics.js';
import { renderVoice } from './screens/voice.js';
import { getCurrentUser, setCurrentUser } from './state.js';
import { errorState } from './ui.js';

const ROUTES = [
  { pattern: /^inicio$/, nav: 'inicio', render: renderHome },
  { pattern: /^movimientos$/, nav: 'movimientos', render: renderMovements },
  { pattern: /^graficos$/, nav: 'graficos', render: renderStatistics },
  { pattern: /^ajustes$/, nav: 'ajustes', render: renderSettings },
  { pattern: /^nuevo$/, render: (root) => renderExpenseForm(root, { mode: 'new' }) },
  { pattern: /^confirmar$/, render: (root) => renderExpenseForm(root, { mode: 'voice' }) },
  { pattern: /^gasto\/(\d+)$/, render: (root, [id]) => renderExpenseForm(root, { mode: 'edit', id }) },
  { pattern: /^voz$/, render: renderVoice },
  { pattern: /^ingresos$/, nav: 'movimientos', render: renderIncomes },
  { pattern: /^ingreso\/nuevo$/, render: (root) => renderIncomeForm(root) },
  { pattern: /^ingreso\/(\d+)$/, render: (root, [id]) => renderIncomeForm(root, { id }) },
  { pattern: /^plan$/, nav: 'plan', render: renderPlan },
  { pattern: /^presupuesto\/(\d{4}-\d{2})$/, render: renderBudgetForm },
  { pattern: /^fijos$/, nav: 'plan', render: renderRecurring },
  { pattern: /^fijo\/nuevo$/, render: (root) => renderRecurringForm(root) },
  { pattern: /^fijo\/(\d+)$/, render: (root, [id]) => renderRecurringForm(root, { id }) },
  { pattern: /^obligacion\/(\d+)$/, render: renderObligation },
  { pattern: /^contrasena$/, render: renderChangePassword },
  { pattern: /^admin$/, render: renderAdmin, admin: true },
  { pattern: /^ingresar$/, render: renderLogin, public: true },
  { pattern: /^registro$/, render: renderRegister, public: true },
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

  const user = getCurrentUser();
  if (!user && !route.public) {
    location.replace('#/ingresar');
    return;
  }
  if (user && route.public) {
    location.replace('#/inicio');
    return;
  }
  if (user?.mustChangePassword && path !== 'contrasena') {
    location.replace('#/contrasena');
    return;
  }
  if (route.admin && user?.role !== 'ADMIN') {
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

// La sesión venció o la cuenta fue desactivada: volver a pedir usuario y contraseña.
window.addEventListener('auth:required', () => {
  if (!getCurrentUser()) return;
  setCurrentUser(null);
  location.hash = '#/ingresar';
});

window.addEventListener('auth:must-change-password', () => {
  const user = getCurrentUser();
  if (user) setCurrentUser({ ...user, mustChangePassword: true });
  location.hash = '#/contrasena';
});

async function start() {
  try {
    setCurrentUser(await api.me());
  } catch (error) {
    if (error.status !== 401) {
      // Sin conexión o servidor caído: no sabemos si hay sesión.
      const screen = document.createElement('div');
      screen.className = 'screen';
      screen.innerHTML = errorState(error.message);
      app.replaceChildren(screen);
      screen.querySelector('[data-action="retry"]').addEventListener('click', start);
      return;
    }
    setCurrentUser(null);
  }
  window.addEventListener('hashchange', navigate);
  navigate();
}

watchConnection();
setupPwa();
start();
