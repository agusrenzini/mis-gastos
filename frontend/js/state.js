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

// Preferencias del teléfono. localStorage puede fallar (modo privado), por eso el try/catch.
const PAYMENT_KEY = 'mis-gastos:payment-method';

export function getPreferredPaymentMethod() {
  try {
    return localStorage.getItem(PAYMENT_KEY) || 'EFECTIVO';
  } catch {
    return 'EFECTIVO';
  }
}

export function setPreferredPaymentMethod(key) {
  try {
    localStorage.setItem(PAYMENT_KEY, key);
  } catch {
    // Sin almacenamiento disponible: no pasa nada, se usa el valor por defecto.
  }
}
