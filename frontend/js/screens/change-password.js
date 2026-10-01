// Cambiar contraseña (#/contrasena). Obligatorio después de que el administrador la restablece.
import { api } from '../api.js';
import { getCurrentUser, setCurrentUser } from '../state.js';
import { icon, showToast, topBar } from '../ui.js';
import { field, hideError, showErrors } from './auth.js';

export function renderChangePassword(root) {
  const forced = Boolean(getCurrentUser()?.mustChangePassword);

  root.innerHTML = `
    ${topBar('Cambiar contraseña', { back: forced ? null : '#/ajustes' })}
    <form class="card auth-card" novalidate>
      ${forced ? `
        <p class="notice">${icon('info')}<span>Ingresaste con una contraseña temporal. Elegí una nueva para seguir usando la app.</span></p>` : ''}
      <div class="form-alert" role="alert" hidden></div>
      ${field('currentPassword', forced ? 'Contraseña temporal' : 'Contraseña actual', 'key',
        { type: 'password', autocomplete: 'current-password' })}
      ${field('newPassword', 'Contraseña nueva', 'key',
        { type: 'password', autocomplete: 'new-password', hint: 'Al menos 6 caracteres.' })}
      ${field('confirmPassword', 'Repetí la contraseña nueva', 'key',
        { type: 'password', autocomplete: 'new-password' })}
      <button type="submit" class="btn btn--primary btn--block btn--lg">${icon('check-circle')}<span>Guardar contraseña</span></button>
      ${forced ? '' : '<a class="btn btn--text btn--block" href="#/ajustes">Cancelar</a>'}
    </form>`;

  const form = root.querySelector('form');
  form.addEventListener('input', (event) => hideError(form, event.target.name));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {
      currentPassword: form.elements.currentPassword.value,
      newPassword: form.elements.newPassword.value,
      confirmPassword: form.elements.confirmPassword.value,
    };
    const errors = {};
    if (!data.currentPassword) errors.currentPassword = 'Ingresá tu contraseña actual.';
    if (data.newPassword.length < 6) errors.newPassword = 'La contraseña tiene que tener al menos 6 caracteres.';
    else if (data.confirmPassword !== data.newPassword) errors.confirmPassword = 'Las contraseñas no coinciden.';
    if (Object.keys(errors).length) {
      showErrors(form, { errors });
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.querySelector('.form-alert').hidden = true;
    try {
      setCurrentUser(await api.changePassword(data));
      showToast('Contraseña actualizada');
      location.hash = forced ? '#/inicio' : '#/ajustes';
    } catch (error) {
      showErrors(form, error);
      button.disabled = false;
    }
  });

  form.elements.currentPassword.focus();
}
