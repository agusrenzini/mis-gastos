// Pantalla Ajustes: cuenta, instalación, estado del servidor y preferencias.
import { api } from '../api.js';
import { PAYMENT_METHODS } from '../categories.js';
import { getInstallPrompt, isStandalone } from '../install.js';
import { getCurrentUser, getPreferredPaymentMethod, setPreferredPaymentMethod } from '../state.js';
import { escapeHtml, icon, showToast, topBar } from '../ui.js';
import { isSpeechRecognitionSupported } from '../voice/speech-recognition-service.js';

export function renderSettings(root) {
  const preferred = getPreferredPaymentMethod();
  const user = getCurrentUser();

  root.innerHTML = `
    ${topBar('Ajustes', { back: '#/inicio' })}

    <section class="card">
      <h2 class="card__title">${icon('user')}Cuenta</h2>
      <ul class="status-list">
        <li><span>Usuario</span><strong>${escapeHtml(user?.username)}</strong></li>
      </ul>
      <div class="account-actions">
        ${user?.role === 'ADMIN'
          ? `<a class="btn btn--soft btn--block" href="#/admin">${icon('users')}Panel de administración</a>` : ''}
        <a class="btn btn--outline btn--block" href="#/contrasena">${icon('key')}Cambiar contraseña</a>
        <button type="button" class="btn btn--text btn--block" data-action="logout">${icon('logout')}Cerrar sesión</button>
      </div>
    </section>

    <section class="card">
      <h2 class="card__title">${icon('download')}Aplicación</h2>
      <div data-slot="install"></div>
    </section>

    <section class="card">
      <h2 class="card__title">${icon('wallet')}Forma de pago predeterminada</h2>
      <p class="muted small">Se preselecciona al cargar un gasto. También se actualiza con la última que usaste.</p>
      <label class="visually-hidden" for="default-payment">Forma de pago predeterminada</label>
      <select id="default-payment" class="input">
        ${PAYMENT_METHODS.map((p) => `<option value="${p.key}" ${p.key === preferred ? 'selected' : ''}>${p.label}</option>`).join('')}
      </select>
    </section>

    <section class="card">
      <h2 class="card__title">${icon('info')}Estado</h2>
      <ul class="status-list">
        <li><span>Servidor</span><span data-slot="server" class="muted">Comprobando…</span></li>
        <li><span>Reconocimiento de voz</span>
          <span class="${isSpeechRecognitionSupported() ? 'ok' : 'warn'}">
            ${isSpeechRecognitionSupported() ? 'Disponible' : 'No disponible en este navegador'}</span></li>
      </ul>
    </section>

    <p class="footnote">Mis Gastos · versión 1.0<br>Tus datos se guardan en tu propio servidor.</p>`;

  renderInstall(root.querySelector('[data-slot="install"]'));

  root.querySelector('[data-action="logout"]').addEventListener('click', async () => {
    try {
      await api.logout();
    } finally {
      // Recargar borra todo lo que quedó en memoria (por ejemplo, un gasto dictado sin confirmar).
      location.hash = '#/ingresar';
      location.reload();
    }
  });

  root.querySelector('#default-payment').addEventListener('change', (event) => {
    setPreferredPaymentMethod(event.target.value);
    showToast('Preferencia guardada');
  });

  const server = root.querySelector('[data-slot="server"]');
  api.getDashboard()
    .then(() => {
      server.textContent = 'Conectado';
      server.className = 'ok';
    })
    .catch((error) => {
      server.textContent = error.offline ? 'Sin conexión' : 'Con problemas';
      server.className = 'warn';
    });
}

function renderInstall(slot) {
  if (isStandalone()) {
    slot.innerHTML = `<p class="ok">${icon('check-circle')}La app ya está instalada en este dispositivo.</p>`;
    return;
  }
  const prompt = getInstallPrompt();
  if (prompt) {
    slot.innerHTML = `
      <p class="muted small">Instalala para abrirla desde la pantalla principal, como cualquier app.</p>
      <button type="button" class="btn btn--primary btn--block">${icon('download')}Instalar Mis Gastos</button>`;
    slot.querySelector('button').addEventListener('click', async () => {
      prompt.prompt();
      await prompt.userChoice;
      renderInstall(slot);
    });
    return;
  }
  slot.innerHTML = `
    <p class="muted small">Para instalarla en el celular:</p>
    <ol class="steps">
      <li><strong>Android (Chrome):</strong> menú ⋮ → <em>Agregar a pantalla principal</em> o <em>Instalar app</em>.</li>
      <li><strong>iPhone (Safari):</strong> botón Compartir → <em>Agregar a inicio</em>.</li>
    </ol>`;
}
