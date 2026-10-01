// Panel de administración (#/admin). Solo resúmenes de actividad: nunca contraseñas ni gastos de otros.
// El servidor vuelve a verificar el rol en cada llamada; ocultar el panel acá es solo comodidad.
import { api } from '../api.js';
import { toISODate } from '../dates.js';
import { formatDate, formatRelativeDay, formatTime } from '../format.js';
import { confirmDialog, errorState, escapeHtml, icon, loadingState, showToast, topBar } from '../ui.js';

export function renderAdmin(root) {
  const load = async () => {
    root.innerHTML = topBar('Administración', { back: '#/ajustes' }) + loadingState('Cargando usuarios…');
    try {
      const [users, unassigned] = await Promise.all([api.adminUsers(), api.adminUnassigned()]);
      mount(root, users, unassigned, load);
    } catch (error) {
      root.innerHTML = topBar('Administración', { back: '#/ajustes' }) + errorState(error.message);
      root.querySelector('[data-action="retry"]')?.addEventListener('click', load);
    }
  };
  load();
}

function mount(root, users, unassigned, reload) {
  const active = users.filter((u) => u.active).length;

  root.innerHTML = `
    ${topBar('Administración', { back: '#/ajustes' })}

    <section class="card">
      <h2 class="card__title">${icon('users')}Usuarios</h2>
      <p class="muted small">${users.length} ${users.length === 1 ? 'cuenta' : 'cuentas'} · ${active} ${active === 1 ? 'activa' : 'activas'}</p>
    </section>

    ${unassigned.count > 0 ? `
      <section class="card">
        <h2 class="card__title">${icon('receipt')}Gastos anteriores a las cuentas</h2>
        <p class="small">Hay <strong>${unassigned.count}</strong> ${unassigned.count === 1 ? 'gasto cargado' : 'gastos cargados'}
          antes de que existieran las cuentas (del ${formatDate(unassigned.firstDate)} al ${formatDate(unassigned.lastDate)}).
          Nadie los ve hasta que los asignes.</p>
        <button type="button" class="btn btn--outline btn--block" data-action="assign">Asignarlos a mi cuenta</button>
      </section>` : ''}

    <ul class="admin-list">
      ${users.map(userCard).join('')}
    </ul>`;

  root.querySelector('[data-action="assign"]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '¿Asignar estos gastos a tu cuenta?',
      message: `Los ${unassigned.count} gastos sin dueño pasan a ser tuyos y los vas a ver en tus movimientos y gráficos.`,
      confirmLabel: 'Asignar',
    });
    if (!ok) return;
    try {
      const { assigned } = await api.adminAssignUnassigned();
      showToast(`${assigned} ${assigned === 1 ? 'gasto asignado' : 'gastos asignados'} a tu cuenta`);
      reload();
    } catch (error) {
      showToast(error.message);
    }
  });

  root.querySelector('.admin-list').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const user = users.find((u) => String(u.id) === button.dataset.id);
    if (!user) return;

    if (button.dataset.action === 'copy') {
      copyPassword(button);
      return;
    }
    if (button.dataset.action === 'toggle') {
      await toggleActive(user, reload);
      return;
    }
    if (button.dataset.action === 'reset') {
      await resetPassword(user, button.closest('.admin-user'));
    }
  });
}

function userCard(user) {
  const isAdmin = user.role === 'ADMIN';
  const activity = user.expenseCount > 0
    ? `${user.expenseCount} ${user.expenseCount === 1 ? 'gasto' : 'gastos'} · última carga ${formatInstant(user.lastExpenseAt)}`
    : 'Todavía no cargó gastos';

  return `
    <li class="card admin-user ${user.active ? '' : 'admin-user--inactive'}">
      <div class="admin-user__head">
        <span class="admin-user__name">${escapeHtml(user.username)}</span>
        ${isAdmin ? '<span class="pill pill--mint">Admin</span>' : ''}
        <span class="tag ${user.active ? '' : 'tag--off'}">${user.active ? 'Activa' : 'Desactivada'}</span>
      </div>
      <p class="small muted">Registrada el ${formatDate(toISODate(new Date(user.createdAt)))}</p>
      <p class="small">${activity}</p>
      ${user.mustChangePassword ? '<p class="small muted">Tiene una contraseña temporal pendiente de cambio.</p>' : ''}
      ${isAdmin ? '' : `
        <div class="admin-user__actions">
          <button type="button" class="btn btn--small ${user.active ? 'btn--danger-ghost' : 'btn--soft'}"
                  data-action="toggle" data-id="${user.id}">${user.active ? 'Desactivar' : 'Reactivar'}</button>
          <button type="button" class="btn btn--small btn--ghost" data-action="reset" data-id="${user.id}">
            ${icon('key')}Restablecer contraseña</button>
        </div>
        <div data-slot="temp-password"></div>`}
    </li>`;
}

/** "Hoy, 13:42" · "Ayer, 09:10" · "Lunes 22 Sep 2026" */
function formatInstant(instant) {
  const day = toISODate(new Date(instant));
  const relative = formatRelativeDay(day, { withYear: true });
  return relative === 'Hoy' || relative === 'Ayer' ? `${relative.toLowerCase()}, ${formatTime(instant)}` : relative;
}

async function toggleActive(user, reload) {
  const ok = await confirmDialog(user.active
    ? {
      title: `¿Desactivar a ${user.username}?`,
      message: 'No va a poder ingresar, pero sus gastos se conservan. Podés reactivar la cuenta cuando quieras.',
      confirmLabel: 'Desactivar',
      danger: true,
    }
    : {
      title: `¿Reactivar a ${user.username}?`,
      message: 'Va a poder ingresar de nuevo y ver todos sus gastos.',
      confirmLabel: 'Reactivar',
    });
  if (!ok) return;
  try {
    await api.adminSetActive(user.id, !user.active);
    showToast(user.active ? 'Cuenta desactivada' : 'Cuenta reactivada');
    reload();
  } catch (error) {
    showToast(error.message);
  }
}

async function resetPassword(user, card) {
  const ok = await confirmDialog({
    title: `¿Restablecer la contraseña de ${user.username}?`,
    message: 'Se genera una contraseña temporal y la actual deja de funcionar. Hacelo solo si te lo pidió.',
    confirmLabel: 'Restablecer',
  });
  if (!ok) return;
  try {
    const { temporaryPassword } = await api.adminResetPassword(user.id);
    card.querySelector('[data-slot="temp-password"]').innerHTML = `
      <div class="temp-password" role="status">
        <p class="small">Contraseña temporal de <strong>${escapeHtml(user.username)}</strong>. Pasásela por un medio privado:
          al ingresar va a tener que elegir una nueva. <strong>No se vuelve a mostrar.</strong></p>
        <div class="temp-password__row">
          <code class="temp-password__value">${escapeHtml(temporaryPassword)}</code>
          <button type="button" class="btn btn--small btn--soft" data-action="copy" data-id="${user.id}"
                  data-value="${escapeHtml(temporaryPassword)}">Copiar</button>
        </div>
      </div>`;
  } catch (error) {
    showToast(error.message);
  }
}

async function copyPassword(button) {
  try {
    await navigator.clipboard.writeText(button.dataset.value);
    showToast('Contraseña copiada');
  } catch {
    showToast('No se pudo copiar: seleccionala y copiala a mano');
  }
}
