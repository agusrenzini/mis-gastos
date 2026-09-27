// Registro del service worker y captura del aviso de instalación de la PWA.

let installPrompt = null;

export function setupPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        // Sin service worker la app funciona igual, solo que no offline.
      });
    });
  }

  // Chrome avisa que la app se puede instalar; guardamos el evento para ofrecerlo en Ajustes.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
  });
}

export function getInstallPrompt() {
  return installPrompt;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
