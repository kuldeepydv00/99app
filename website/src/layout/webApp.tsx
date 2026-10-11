import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BellRing, BellOff, Download, Share, SquarePlus, MoreVertical, X, Check, Smartphone } from 'lucide-react';

// The web app: the website installed on the phone's home screen (no APK), an offline screen
// (public/sw.js + public/offline.html) and phone notifications (web push, see backend utils/webPush.js).

// ---------- where we are running ----------
export const isStandalone = () => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || (navigator as any).standalone === true;
  } catch { return false; }
};
export const isIOS = () => {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};
const isAndroid = () => /Android/i.test(navigator.userAgent || '');

// Chrome / Edge / Samsung on Android and desktop offer their own "Install" dialog. The browser
// announces it once, early, so it is caught here before React starts (registerWebApp in main.tsx).
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let installPrompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(f => f());

export function registerWebApp() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e as InstallPrompt; changed(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; changed(); });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ });
    });
    // a tapped phone notification asks the open app to show the bell
    navigator.serviceWorker.addEventListener('message', ev => {
      if (ev.data && ev.data.type === 'open-notifications') window.dispatchEvent(new Event('99x-open-notifications'));
    });
  }
}

/** The "Install app" button: shows the browser's install dialog, or how to do it on this phone. */
export function useInstallApp() {
  const [installed, setInstalled] = useState(isStandalone);
  const [, force] = useState(0);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const f = () => { force(x => x + 1); setInstalled(isStandalone()); };
    listeners.add(f);
    let mq: MediaQueryList | null = null;
    try { mq = window.matchMedia('(display-mode: standalone)'); mq.addEventListener('change', f); } catch { /* old browsers */ }
    return () => { listeners.delete(f); try { mq?.removeEventListener('change', f); } catch { /* ignore */ } };
  }, []);
  const install = async () => {
    if (installPrompt) {
      const p = installPrompt;
      try {
        await p.prompt();
        const choice = await p.userChoice;
        if (choice.outcome === 'accepted') { installPrompt = null; changed(); }
        return;
      } catch { /* fall back to the steps */ }
    }
    setSheet(true);
  };
  return { installed, install, sheet, closeSheet: () => setSheet(false) };
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nv-gold text-[13px] font-bold text-black">{n}</span>
      <span className="pt-0.5 text-[13.5px] leading-relaxed text-nv-text">{children}</span>
    </li>
  );
}
const Key = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-white">{children}</strong>;
const Ico = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex h-6 w-6 translate-y-1.5 items-center justify-center rounded-md bg-nv-card2 text-white">{children}</span>
);

/** How to install, for phones where the browser has no install dialog (iPhone, Firefox…). */
export function InstallSheet({ onClose }: { onClose: () => void }) {
  const ios = isIOS();
  const android = isAndroid();
  return (
    <div className="nv-fade fixed inset-0 z-[80] flex items-end justify-center bg-black/70 font-nv sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label="Install the app" className="w-full max-w-md overflow-hidden rounded-t-2xl bg-nv-panel shadow-2xl ring-1 ring-white/5 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-black/30 px-4 py-3.5">
          <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-white">Install 99xmatka</h3>
            <p className="text-[12px] text-nv-mute">Opens full screen from your home screen. No APK, no download.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="nv-tap flex h-8 w-8 items-center justify-center rounded-md text-nv-mute hover:bg-nv-card2 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <ol className="space-y-4 px-5 py-5">
          {ios ? (
            <>
              <Step n={1}>Tap the <Key>Share</Key> button <Ico><Share className="h-3.5 w-3.5" /></Ico> at the bottom (or top) of Safari.</Step>
              <Step n={2}>Scroll down and tap <Ico><SquarePlus className="h-3.5 w-3.5" /></Ico> <Key>Add to Home Screen</Key>.</Step>
              <Step n={3}>Tap <Key>Add</Key>. Open 99xmatka from your home screen.</Step>
            </>
          ) : android ? (
            <>
              <Step n={1}>Tap the browser menu <Ico><MoreVertical className="h-3.5 w-3.5" /></Ico> (top right).</Step>
              <Step n={2}>Tap <Key>Install app</Key> or <Key>Add to Home screen</Key>.</Step>
              <Step n={3}>Tap <Key>Install</Key>. Open 99xmatka from your home screen.</Step>
            </>
          ) : (
            <>
              <Step n={1}>Click the install icon <Ico><Download className="h-3.5 w-3.5" /></Ico> at the right end of the address bar, or open the browser menu.</Step>
              <Step n={2}>Choose <Key>Install 99xmatka</Key>.</Step>
              <Step n={3}>It opens in its own window and gets an icon like any other app.</Step>
            </>
          )}
        </ol>
        {ios && <p className="px-5 pb-5 text-[12px] leading-relaxed text-nv-mute">Phone notifications on iPhone work only after you install the app this way and open it from the home screen.</p>}
      </div>
    </div>
  );
}

// ---------- phone notifications (web push) ----------
const API = typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5002' : '';
const token = () => { try { return localStorage.getItem('99x_web_token') || ''; } catch { return ''; } };

async function api(path: string, body?: unknown, tok = token()) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

const keyBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export type PhoneAlerts = 'unsupported' | 'install-first' | 'blocked' | 'off' | 'on' | 'busy';

const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Turns phone notifications on/off for the logged-in player. */
export function usePhoneAlerts(loggedIn: boolean) {
  const [state, setState] = useState<PhoneAlerts>('off');
  const [error, setError] = useState('');

  const check = async () => {
    if (!pushSupported()) { setState(isIOS() && !isStandalone() ? 'install-first' : 'unsupported'); return; }
    if (Notification.permission === 'denied') { setState('blocked'); return; }
    try {
      const sub = await currentSubscription();
      setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
      // logged in again (maybe as someone else) on this phone: tell the server whose phone it is
      if (sub && loggedIn && Notification.permission === 'granted') api('/api/user/push/subscribe', { subscription: sub.toJSON() }).catch(() => {});
    } catch { setState('off'); }
  };
  useEffect(() => { if (loggedIn) check(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [loggedIn]);

  const turnOn = async () => {
    setError('');
    if (!pushSupported()) { setState(isIOS() && !isStandalone() ? 'install-first' : 'unsupported'); return; }
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); return; }
      const { publicKey } = await api('/api/push/public-key');
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      // a subscription made with another server key can't receive our messages
      if (sub && sub.options && sub.options.applicationServerKey) {
        const have = new Uint8Array(sub.options.applicationServerKey as ArrayBuffer);
        const want = keyBytes(publicKey);
        if (have.length !== want.length || have.some((b, i) => b !== want[i])) { await sub.unsubscribe(); sub = null; }
      }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      await api('/api/user/push/subscribe', { subscription: sub.toJSON() });
      setState('on');
    } catch (e: any) {
      setError(e && e.message ? e.message : 'Could not turn on notifications');
      setState('off');
    }
  };

  const turnOff = async () => {
    setError('');
    setState('busy');
    try {
      const sub = await currentSubscription();
      if (sub) {
        await api('/api/user/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
    } catch { /* ignore */ }
    setState('off');
  };

  return { state, error, turnOn, turnOff };
}

/** Logging out: this phone stops getting that player's notifications. Call before the token is removed. */
export function dropPhoneAlerts() {
  const tok = token();
  currentSubscription().then(sub => {
    if (!sub) return;
    if (tok) api('/api/user/push/unsubscribe', { endpoint: sub.endpoint }, tok).catch(() => {});
    return sub.unsubscribe();
  }).catch(() => {});
}

/** The card at the top of the notifications panel. */
export function PhoneAlertsCard({ alerts, onInstall }: { alerts: ReturnType<typeof usePhoneAlerts>; onInstall: () => void }) {
  const { state, error, turnOn, turnOff } = alerts;
  if (state === 'unsupported') return null;
  const box = 'flex items-start gap-3 rounded-xl px-3.5 py-3 ring-1';
  if (state === 'on') {
    return (
      <div className={`${box} bg-nv-green/10 ring-nv-green/25`}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nv-green/20 text-nv-green"><Check className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Phone notifications are on</p>
          <p className="text-[12px] text-nv-text">Deposits, withdrawals, wins and results pop up on this phone, even when the app is closed.</p>
        </div>
        <button onClick={turnOff} className="nv-tap shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-nv-mute hover:text-white">Turn off</button>
      </div>
    );
  }
  if (state === 'blocked') {
    return (
      <div className={`${box} bg-nv-card2/60 ring-white/5`}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-nv-mute"><BellOff className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Notifications are blocked</p>
          <p className="text-[12px] text-nv-text">Allow notifications for this site in your browser or phone settings, then come back here.</p>
        </div>
      </div>
    );
  }
  if (state === 'install-first') {
    return (
      <div className={`${box} bg-nv-blue/10 ring-nv-blue/25`}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nv-blue/20 text-nv-blue2"><Smartphone className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Get notifications on your iPhone</p>
          <p className="text-[12px] text-nv-text">Install the app to your home screen first, open it from there, then turn notifications on here.</p>
        </div>
        <button onClick={onInstall} className="nv-tap shrink-0 rounded-md bg-nv-blue px-3 py-1.5 text-[12px] font-bold text-white">How?</button>
      </div>
    );
  }
  return (
    <div className={`${box} bg-nv-gold/10 ring-nv-gold/25`}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nv-gold/20 text-nv-gold"><BellRing className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-white">Get phone notifications</p>
        <p className="text-[12px] text-nv-text">Know the moment a deposit lands, a withdrawal is paid or you win, even when the app is closed.</p>
        {error && <p className="mt-1 text-[12px] text-nv-red">{error}</p>}
      </div>
      <button onClick={turnOn} disabled={state === 'busy'} className="nv-tap shrink-0 rounded-md bg-nv-gold px-3 py-1.5 text-[12px] font-bold text-black disabled:opacity-60">
        {state === 'busy' ? '…' : 'Turn on'}
      </button>
    </div>
  );
}
