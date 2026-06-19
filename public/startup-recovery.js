(function () {
  const recoveryStorageKey = 'sigma-file-manager:module-load-recovery-at';
  const recoveryWindowMs = 30000;
  const reloadDelayMs = 1500;
  const recoveryMessage = 'Failed to load Sigma File Manager. Please restart the app.';

  function getLastRecoveryAt() {
    try {
      const storedValue = sessionStorage.getItem(recoveryStorageKey);
      const recoveryTime = Number(storedValue || '0');

      return Number.isFinite(recoveryTime) ? recoveryTime : 0;
    }
    catch {
      return 0;
    }
  }

  function setLastRecoveryAt(recoveryTime) {
    try {
      sessionStorage.setItem(recoveryStorageKey, String(recoveryTime));
      return true;
    }
    catch {
      return false;
    }
  }

  function showRecoveryMessage() {
    const splashElement = document.getElementById('app-splash');

    if (!splashElement) {
      return;
    }

    splashElement.textContent = '';
    const messageElement = document.createElement('div');
    messageElement.textContent = recoveryMessage;
    messageElement.style.maxWidth = '320px';
    messageElement.style.padding = '0 24px';
    messageElement.style.color = 'rgba(255, 255, 255, 0.78)';
    messageElement.style.font = '14px system-ui, sans-serif';
    messageElement.style.lineHeight = '1.45';
    messageElement.style.textAlign = 'center';
    splashElement.appendChild(messageElement);
  }

  function recoverFromModuleLoadFailure() {
    const currentTime = Date.now();

    if (currentTime - getLastRecoveryAt() < recoveryWindowMs) {
      showRecoveryMessage();
      return;
    }

    if (!setLastRecoveryAt(currentTime)) {
      showRecoveryMessage();
      return;
    }

    setTimeout(function () {
      window.location.reload();
    }, reloadDelayMs);
  }

  window.addEventListener('error', function (event) {
    const target = event.target;

    if (target instanceof HTMLScriptElement && target.type === 'module') {
      recoverFromModuleLoadFailure();
    }
  }, true);
}());
