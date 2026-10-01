// Agregar movimiento (#/agregar): elegir entre ingreso y egreso, a mano o por voz.
import { icon, topBar } from '../ui.js';
import { getLastSection } from '../state.js';

export function renderAddMovement(root) {
  root.innerHTML = `
    ${topBar('Agregar movimiento', { back: getLastSection('#/inicio') })}
    <p class="muted">¿Qué querés registrar?</p>
    <div class="kind-choice">
      <a class="kind-tile kind-tile--expense" href="#/nuevo">
        <span class="kind-tile__sign" aria-hidden="true">−</span>
        <span class="kind-tile__title">Egreso</span>
        <span class="kind-tile__hint">Un gasto, una compra o un pago</span>
      </a>
      <a class="kind-tile kind-tile--income" href="#/ingreso/nuevo">
        <span class="kind-tile__sign" aria-hidden="true">+</span>
        <span class="kind-tile__title">Ingreso</span>
        <span class="kind-tile__hint">Sueldo, un cobro o un trabajo</span>
      </a>
    </div>
    <a class="voice-cta" href="#/voz">
      <span class="voice-cta__mic">${icon('mic')}</span>
      <span>Dictarlo por voz</span>
      <span class="voice-cta__wave" aria-hidden="true"><i></i><i></i><i></i></span>
    </a>
    <p class="footnote">${icon('info')}Para planificar un ingreso que todavía no cobraste, cargalo como <strong>esperado</strong>.</p>`;
}
