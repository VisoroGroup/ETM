import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'

if (typeof window !== 'undefined') {
  // Claim the named-window target: when an email link's target="sarcinator-app"
  // survives (in-browser clicks, e.g. Gmail web), the browser reuses and
  // focuses this tab instead of opening a new one. Desktop email clients
  // (Apple Mail, Outlook) strip the target, so their clicks open a fresh tab
  // where the task opens in place. The earlier BroadcastChannel handoff that
  // forwarded the task to an existing tab was removed on 2026-06-12: the
  // browser can't focus the receiving tab, so users were left staring at a
  // blank landing page ("the link does nothing") — an extra tab is the
  // lesser evil.
  window.name = 'sarcinator-app';

  // Stale-deploy self-heal: after a Railway deploy the old tab's lazy-route
  // imports reference chunk hashes that no longer exist ("Importing a module
  // script failed"). Vite fires vite:preloadError for those; reload once to
  // pick up the fresh index.html (served no-cache). The timestamp latch keeps
  // a genuinely broken network from looping reloads.
  window.addEventListener('vite:preloadError', (event) => {
    const KEY = 'visoro_chunk_reload_ts';
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return; // let the error surface instead
    sessionStorage.setItem(KEY, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  });
}

// Init Sentry (only if DSN is set via env)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // 10% traces in production
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // 5% session replays
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
