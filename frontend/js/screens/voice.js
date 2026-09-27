// Pantalla de registro por voz: escucha → transcribe → interpreta → pasa a confirmación.
import { setVoiceDraft } from '../state.js';
import { escapeHtml, icon, topBar } from '../ui.js';
import { parseExpense } from '../voice/expense-parser.js';
import { SpeechRecognitionService, isSpeechRecognitionSupported } from '../voice/speech-recognition-service.js';

export function renderVoice(root) {
  const supported = isSpeechRecognitionSupported();
  const speech = new SpeechRecognitionService({ lang: 'es-AR' });

  root.innerHTML = `
    ${topBar('Nuevo gasto', { back: '#/inicio' })}
    <section class="voice">
      <span class="pill pill--soft"><span class="dot dot--primary" aria-hidden="true"></span>Entrada inteligente</span>
      <h2 class="voice__title">Contame qué gastaste</h2>
      <p class="voice__subtitle">Hablá de forma natural. Detectamos el monto, la categoría y la fecha.</p>

      <div class="card tip-card">
        <span class="tip-card__icon">${icon('bulb')}</span>
        <div>
          <p class="overline">Probá decir:</p>
          <p class="tip-card__example">“Gasté 18 mil pesos en una cena ayer”</p>
        </div>
      </div>

      ${supported ? `
        <p class="status-pill" data-slot="status" role="status">Tocá el micrófono para empezar</p>
        <button type="button" class="mic-button" data-action="toggle" aria-pressed="false" aria-label="Empezar a escuchar">
          <span class="mic-button__ring mic-button__ring--3" aria-hidden="true"></span>
          <span class="mic-button__ring mic-button__ring--2" aria-hidden="true"></span>
          <span class="mic-button__ring mic-button__ring--1" aria-hidden="true"></span>
          <span class="mic-button__core">${icon('mic')}</span>
        </button>
        <div class="sound-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="card transcript-card" aria-live="polite">
          <p class="transcript-card__label">Transcripción en tiempo real</p>
          <p class="transcript-card__text" data-slot="transcript">…</p>
        </div>
        <button type="button" class="btn btn--soft btn--block btn--lg" data-action="toggle" data-slot="main-button">
          ${icon('mic')}<span>Tocar para hablar</span>
        </button>` : `
        <div class="card notice-card" role="alert">
          ${icon('info')}
          <p>El reconocimiento de voz no está disponible en este navegador.
             Podés registrar el gasto manualmente.</p>
        </div>
        <a class="btn btn--primary btn--block btn--lg" href="#/nuevo">${icon('plus-circle')}Registrar manualmente</a>`}

      <form class="typed-phrase" data-slot="typed">
        <label class="field-label" for="phrase">${supported ? 'O escribí la frase' : 'O escribí la frase como la dirías'}</label>
        <div class="typed-phrase__row">
          <input id="phrase" name="phrase" class="input" autocomplete="off" placeholder="Ej: 10 lucas de nafta">
          <button type="submit" class="icon-button icon-button--primary" aria-label="Interpretar frase">${icon('arrow-right')}</button>
        </div>
      </form>

      <a class="btn btn--text btn--block" href="#/inicio">Cancelar y volver</a>
      <p class="footnote">${icon('info')}Podés mencionar monto, categoría, fecha o forma de pago</p>
    </section>`;

  const goToConfirmation = (text) => {
    setVoiceDraft(parseExpense(text));
    location.hash = '#/confirmar';
  };

  root.querySelector('[data-slot="typed"]').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = event.target.elements.phrase.value.trim();
    if (text) goToConfirmation(text);
  });

  if (!supported) return undefined;

  const status = root.querySelector('[data-slot="status"]');
  const transcript = root.querySelector('[data-slot="transcript"]');
  const mainButton = root.querySelector('[data-slot="main-button"]');
  const micButton = root.querySelector('.mic-button');
  let listening = false;

  const setListening = (value, message) => {
    listening = value;
    root.querySelector('.voice').classList.toggle('is-listening', value);
    micButton.setAttribute('aria-pressed', String(value));
    micButton.setAttribute('aria-label', value ? 'Terminar de escuchar' : 'Empezar a escuchar');
    mainButton.innerHTML = value
      ? `${icon('stop', 'icon--danger')}<span>Tocar para finalizar</span>`
      : `${icon('mic')}<span>Tocar para hablar</span>`;
    if (message) status.textContent = message;
  };

  const start = () => {
    transcript.textContent = '…';
    setListening(true, 'Escuchando…');
    speech.start({
      onInterim: (text) => {
        transcript.innerHTML = `“${escapeHtml(text)}…”`;
      },
      onResult: (text) => {
        status.textContent = 'Listo, interpretando…';
        goToConfirmation(text);
      },
      onError: (message) => setListening(false, message),
      onEnd: () => {
        if (listening) setListening(false);
      },
    });
  };

  root.querySelectorAll('[data-action="toggle"]').forEach((button) => {
    button.addEventListener('click', () => (listening ? speech.stop() : start()));
  });

  // Empieza a escuchar apenas se entra: una acción menos para registrar rápido.
  start();

  return () => speech.abort();
}
