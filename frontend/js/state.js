// Estado compartido entre pantallas.

// El gasto interpretado por voz, esperando confirmación. Vive en memoria:
// si se recarga la página se pierde, y eso está bien (nunca se guarda sin confirmar).
let voiceDraft = null;

export function setVoiceDraft(draft) {
  voiceDraft = draft;
}

export function takeVoiceDraft() {
  const draft = voiceDraft;
  voiceDraft = null;
  return draft;
}

// Usuario con sesión iniciada: { username, role, mustChangePassword } o null.
let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

// Preferencias del teléfono, separadas por usuario (por si dos personas usan el mismo celular).
// localStorage puede fallar (modo privado), por eso el try/catch.
const paymentKey = () => `mis-gastos:payment-method:${currentUser?.username ?? ''}`;

export function getPreferredPaymentMethod() {
  try {
    return localStorage.getItem(paymentKey()) || 'EFECTIVO';
  } catch {
    return 'EFECTIVO';
  }
}

export function setPreferredPaymentMethod(key) {
  try {
    localStorage.setItem(paymentKey(), key);
  } catch {
    // Sin almacenamiento disponible: no pasa nada, se usa el valor por defecto.
  }
}
