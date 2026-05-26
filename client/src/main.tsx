import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'

// Tab reuse: if a notification email link spawns a fresh ETM tab while another
// ETM tab is already open, hand the request to the existing tab and close this
// one. The plain target="sarcinator-app" attribute alone isn't enough — most
// desktop email clients (Apple Mail, Outlook, Thunderbird) strip the target
// when launching the system browser, so each click otherwise opens a new tab.
//
// Mechanism: BroadcastChannel('sarcinator-tabs'). The newly opened tab asks
// "who's there?" early; an existing tab replies, we transfer the openTaskId
// + companyId, focus the existing tab via a request it acts on, then close
// self. If no reply within 600ms, we're the only tab → render normally.
const TAB_CHANNEL = 'sarcinator-tabs';
const TAB_HANDOFF_TIMEOUT_MS = 600;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  window.name = 'sarcinator-app';
  const url = new URL(window.location.href);
  const openTaskId = url.searchParams.get('openTaskId');
  const companyId = url.searchParams.get('companyId');
  const isHandoffLandingPage = !!openTaskId
    && url.pathname.replace(/\/+$/, '') === '/tasks';

  // Listener: every ETM tab answers discovery pings and handles handoff requests.
  const listener = new BroadcastChannel(TAB_CHANNEL);
  listener.onmessage = (ev) => {
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'sarcinator:ping') {
      // Respond only if we're a "real" tab (not a handoff landing tab still
      // waiting to redirect). otherwise two new tabs could ping-pong replies.
      if (!isHandoffLandingPage) listener.postMessage({ type: 'sarcinator:pong' });
    }
    if (data.type === 'sarcinator:open-task') {
      const params = new URLSearchParams();
      params.set('openTaskId', data.taskId);
      if (data.companyId) params.set('companyId', data.companyId);
      // Rewrite our URL and re-fire the route effect so TaskListPage picks it up.
      window.history.pushState({}, '', `/tasks?${params.toString()}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      // Pull the user's attention to this tab. focus() is a hint — modern
      // browsers only honor it for tabs that user has interacted with, but
      // it's the best we can do from JS.
      try { window.focus(); } catch { /* noop */ }
    }
  };

  // Handoff sender: only fresh "email landing" tabs probe for siblings.
  if (isHandoffLandingPage) {
    const handoff = new BroadcastChannel(TAB_CHANNEL);
    let handed = false;
    handoff.onmessage = (ev) => {
      if (handed || ev.data?.type !== 'sarcinator:pong') return;
      handed = true;
      handoff.postMessage({
        type: 'sarcinator:open-task',
        taskId: openTaskId,
        companyId: companyId ?? null,
      });
      handoff.close();
      // Small delay so the existing tab actually receives the message before
      // this one disappears. window.close() only works on tabs opened by JS;
      // for email-launched tabs we fall back to navigating to about:blank.
      setTimeout(() => {
        try { window.close(); } catch { /* noop */ }
        if (!window.closed) window.location.replace('about:blank');
      }, 150);
    };
    handoff.postMessage({ type: 'sarcinator:ping' });
    setTimeout(() => { if (!handed) handoff.close(); }, TAB_HANDOFF_TIMEOUT_MS);
  }
} else if (typeof window !== 'undefined') {
  // Browser without BroadcastChannel — still claim the named-window target.
  window.name = 'sarcinator-app';
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
