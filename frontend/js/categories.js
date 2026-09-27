// Catálogo de categorías y formas de pago. Las claves coinciden con los enums del backend.

export const CATEGORIES = [
  { key: 'COMIDA', label: 'Comida', emoji: '🍔', color: '#F97316', bg: '#FFEDD5' },
  { key: 'TRANSPORTE', label: 'Transporte', emoji: '🚗', color: '#0EA5E9', bg: '#E0F2FE' },
  { key: 'ENTRETENIMIENTO', label: 'Entretenimiento', emoji: '🎮', color: '#D946EF', bg: '#FAE8FF' },
  { key: 'ROPA', label: 'Ropa', emoji: '👕', color: '#EC4899', bg: '#FCE7F3' },
  { key: 'PAREJA', label: 'Pareja', emoji: '❤️', color: '#EF4444', bg: '#FEE2E2' },
  { key: 'SALIDAS', label: 'Salidas', emoji: '🍻', color: '#8B5CF6', bg: '#EDE9FE' },
  { key: 'FACULTAD', label: 'Facultad', emoji: '📚', color: '#EAB308', bg: '#FEF9C3' },
  { key: 'TECNOLOGIA', label: 'Tecnología', emoji: '💻', color: '#0D9488', bg: '#CCFBF1' },
  { key: 'HOGAR', label: 'Hogar', emoji: '🏠', color: '#6366F1', bg: '#E0E7FF' },
  { key: 'SALUD', label: 'Salud', emoji: '💊', color: '#22C55E', bg: '#DCFCE7' },
  { key: 'SUSCRIPCIONES', label: 'Suscripciones', emoji: '💳', color: '#B45309', bg: '#FEF3C7' },
  { key: 'OTROS', label: 'Otros', emoji: '📦', color: '#64748B', bg: '#F1F5F9' },
];

export const PAYMENT_METHODS = [
  { key: 'EFECTIVO', label: 'Efectivo', icon: 'cash' },
  { key: 'MERCADO_PAGO', label: 'Mercado Pago', icon: 'wallet' },
  { key: 'DEBITO', label: 'Débito', icon: 'card' },
  { key: 'CREDITO', label: 'Crédito', icon: 'card' },
  { key: 'TRANSFERENCIA', label: 'Transferencia', icon: 'transfer' },
];

const byKey = (list) => Object.fromEntries(list.map((item) => [item.key, item]));
const CATEGORY_MAP = byKey(CATEGORIES);
const PAYMENT_MAP = byKey(PAYMENT_METHODS);

export function getCategory(key) {
  return CATEGORY_MAP[key] ?? CATEGORY_MAP.OTROS;
}

export function getPaymentMethod(key) {
  return PAYMENT_MAP[key] ?? { key, label: key, icon: 'card' };
}
