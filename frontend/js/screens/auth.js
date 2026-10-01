// Pantallas de inicio de sesión (#/ingresar) y registro (#/registro).
// Solo usuario y contraseña: sin correo ni verificación.
import { api } from '../api.js';
import { setCurrentUser } from '../state.js';
import { escapeHtml, icon } from '../ui.js';

export function renderLogin(root) {
  mountAuthForm(root, {
    title: 'Ingresá a tu cuenta',
    subtitle: 'Registrá tus gastos por voz o a mano en segundos.',
    submitLabel: 'Ingresar',
    busyLabel: 'Ingresando…',
    register: false,
    footer: `<span>¿Es tu primera vez?</span><a class="btn btn--outline btn--block" href="#/registro">Crear cuenta</a>`,
    submit: (form) => api.login(form.elements.username.value, form.elements.password.value),
  });
}

export function renderRegister(root) {
  mountAuthForm(root, {
    title: 'Creá tu cuenta',
    subtitle: 'Solo necesitás un nombre de usuario y una contraseña.',
    submitLabel: 'Crear cuenta',
    busyLabel: 'Creando cuenta…',
    register: true,
    footer: `<span>¿Ya tenés cuenta?</span><a class="btn btn--outline btn--block" href="#/ingresar">Ingresar</a>`,
    submit: (form) => api.register({
      username: form.elements.username.value,
      password: form.elements.password.value,
      confirmPassword: form.elements.confirmPassword.value,
    }),
  });
}

function mountAuthForm(root, options) {
  root.innerHTML = `
    <header class="auth-hero">
      <span class="auth-hero__mark" aria-hidden="true">${icon('wallet')}</span>
      <h1 class="auth-hero__title topbar__title" tabindex="-1">Mis Gastos</h1>
    </header>

    <form class="card auth-card" novalidate>
      <h2 class="card__title">${escapeHtml(options.title)}</h2>
      <p class="muted small">${escapeHtml(options.subtitle)}</p>
      <div class="form-alert" role="alert" hidden></div>

      ${field('username', 'Usuario', 'user', {
        autocomplete: 'username',
        hint: options.register ? 'De 3 a 30 letras o números. Sin espacios.' : '',
      })}
      ${field('password', 'Contraseña', 'key', {
        type: 'password',
        autocomplete: options.register ? 'new-password' : 'current-password',
        hint: options.register ? 'Al menos 6 caracteres.' : '',
      })}
      ${options.register ? field('confirmPassword', 'Repetí la contraseña', 'key', {
        type: 'password',
        autocomplete: 'new-password',
      }) : ''}

      <button type="submit" class="btn btn--primary btn--block btn--lg">${icon('check-circle')}<span>${options.submitLabel}</span></button>
      <div class="auth-card__footer">${options.footer}</div>
    </form>`;

  const form = root.querySelector('form');
  form.addEventListener('input', (event) => hideError(form, event.target.name));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errors = validate(form, options.register);
    if (Object.keys(errors).length) {
      showErrors(form, { errors });
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.querySelector('span').textContent = options.busyLabel;
    form.querySelector('.form-alert').hidden = true;
    try {
      const user = await options.submit(form);
      setCurrentUser(user);
      location.hash = user.mustChangePassword ? '#/contrasena' : '#/inicio';
    } catch (error) {
      showErrors(form, error);
      button.disabled = false;
      button.querySelector('span').textContent = options.submitLabel;
    }
  });

  form.elements.username.focus();
}

/** Campo de formulario con etiqueta, ayuda opcional y lugar para el error. */
export function field(name, label, iconName, { type = 'text', autocomplete = 'off', hint = '' } = {}) {
  return `
    <div class="auth-field">
      <label class="field-label" for="${name}">${icon(iconName)}${label}</label>
      <input id="${name}" name="${name}" type="${type}" class="input" autocomplete="${autocomplete}"
             autocapitalize="none" spellcheck="false" maxlength="64"
             aria-describedby="${name}-error${hint ? ` ${name}-hint` : ''}">
      ${hint ? `<p id="${name}-hint" class="auth-field__hint">${hint}</p>` : ''}
      <p id="${name}-error" class="field-error" hidden></p>
    </div>`;
}

function validate(form, register) {
  const errors = {};
  const username = form.elements.username.value.trim();
  const password = form.elements.password.value;
  if (!username) errors.username = 'Ingresá tu usuario.';
  if (!password) errors.password = 'Ingresá tu contraseña.';
  if (register) {
    if (username && !/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
      errors.username = 'Usá de 3 a 30 letras, números, punto, guion o guion bajo (sin espacios).';
    }
    if (password && password.length < 6) errors.password = 'La contraseña tiene que tener al menos 6 caracteres.';
    if (password && form.elements.confirmPassword.value !== password) {
      errors.confirmPassword = 'Las contraseñas no coinciden.';
    }
  }
  return errors;
}

/** Muestra errores por campo y, si no hay ninguno, el mensaje general arriba. */
export function showErrors(form, error) {
  const fieldErrors = error.errors ?? {};
  let shown = false;
  Object.entries(fieldErrors).forEach(([name, message]) => {
    const el = form.querySelector(`#${name}-error`);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    form.elements[name]?.setAttribute('aria-invalid', 'true');
    if (!shown) form.elements[name]?.focus();
    shown = true;
  });
  if (!shown && error.message) {
    const alert = form.querySelector('.form-alert');
    alert.textContent = error.message;
    alert.hidden = false;
  }
}

export function hideError(form, name) {
  if (!name) return;
  const el = form.querySelector(`#${name}-error`);
  if (el) el.hidden = true;
  form.elements[name]?.removeAttribute('aria-invalid');
}
