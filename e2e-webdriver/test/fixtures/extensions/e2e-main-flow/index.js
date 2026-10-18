// Local test extension for the WebDriver e2e suite.
// It declares only the "notifications" permission, makes one call that the
// permission allows and one call ("shell") that it does not, and reports both
// outcomes as notifications so the test can observe them in the app UI.

const RESULT_PREFIX = 'sfm-e2e-main-flow';
const NOTIFICATION_DURATION_MS = 8000;

function report(description) {
  return sigma.ui.showNotification({
    title: 'E2E Main Flow',
    description: `${RESULT_PREFIX}: ${description}`,
    duration: NOTIFICATION_DURATION_MS,
  });
}

export async function activate() {
  await report('permitted call ok');

  try {
    await sigma.shell.run('cmd.exe', ['/c', 'exit', '0']);
    await report('denied call unexpectedly allowed');
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await report(`denied call rejected: ${message}`);
  }
}

export async function deactivate() {}
