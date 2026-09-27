// Envoltorio del reconocimiento de voz del navegador (Web Speech API).
// La pantalla de voz solo conoce esta interfaz: start / stop / abort + callbacks.
// Para usar otro motor (por ejemplo, una API de transcripción) se reemplaza esta clase
// por otra con los mismos métodos, sin tocar la pantalla ni el parser.

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export function isSpeechRecognitionSupported() {
  return Boolean(Recognition);
}

const ERROR_MESSAGES = {
  'not-allowed': 'No hay permiso para usar el micrófono. Habilitalo en la configuración del navegador.',
  'service-not-allowed': 'El navegador no permite el reconocimiento de voz en esta página.',
  'no-speech': 'No escuché nada. Tocá el micrófono e intentá de nuevo.',
  'audio-capture': 'No se encontró un micrófono.',
  network: 'El reconocimiento de voz necesita conexión a internet.',
  'language-not-supported': 'El idioma español no está disponible para el reconocimiento de voz.',
};

export class SpeechRecognitionService {
  constructor({ lang = 'es-AR' } = {}) {
    this.lang = lang;
    this.recognition = null;
  }

  /**
   * @param {{onInterim?: (text: string) => void,
   *          onResult: (text: string) => void,
   *          onError?: (message: string) => void,
   *          onEnd?: () => void}} handlers
   */
  start({ onInterim, onResult, onError, onEnd }) {
    if (!Recognition) {
      onError?.('El reconocimiento de voz no está disponible en este navegador.');
      return;
    }
    this.abort();

    const recognition = new Recognition();
    recognition.lang = this.lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = '';
    let interimText = '';
    let failed = false;

    recognition.onresult = (event) => {
      finalText = '';
      interimText = '';
      for (const result of event.results) {
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      onInterim?.((finalText + interimText).trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      failed = true;
      onError?.(ERROR_MESSAGES[event.error] ?? 'No se pudo reconocer la voz. Probá de nuevo.');
    };

    recognition.onend = () => {
      this.recognition = null;
      const text = (finalText || interimText).trim();
      if (!failed && text) onResult(text);
      else if (!failed) onError?.(ERROR_MESSAGES['no-speech']);
      onEnd?.();
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.recognition = null;
      onError?.('No se pudo iniciar el micrófono. Probá de nuevo.');
      onEnd?.();
    }
  }

  /** Termina de escuchar y entrega lo reconocido hasta ahora. */
  stop() {
    this.recognition?.stop();
  }

  /** Cancela sin entregar resultado (al salir de la pantalla). */
  abort() {
    if (!this.recognition) return;
    const r = this.recognition;
    r.onresult = r.onerror = r.onend = null;
    r.abort();
    this.recognition = null;
  }
}
