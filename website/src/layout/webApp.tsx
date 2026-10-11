import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BellRing, BellOff, Download, Share, SquarePlus, X, Check, Smartphone, Zap, ShieldCheck } from 'lucide-react';

// The 99xmatka app: the Android APK (android-app/, opens this website full screen) is downloaded
// from the "Download App" popup. Also here: offline screen (public/sw.js + public/offline.html)
// and phone notifications (web push, see backend utils/webPush.js).

export const APK_URL = '/99xmatka.apk';

// ---------- where we are running ----------
export const isIOS = () => {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};
export const isAndroid = () => /Android/i.test(navigator.userAgent || '');
const isPhone = () => isAndroid() || isIOS() || /Mobi/i.test(navigator.userAgent || '');

/** Opened inside the 99xmatka Android app (or from an iPhone home-screen icon). */
export const inApp = (() => {
  let cached: boolean | null = null;
  return () => {
    if (cached !== null) return cached;
    let v = false;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('source') === 'apk') sessionStorage.setItem('99x_in_app', '1');
      v = sessionStorage.getItem('99x_in_app') === '1'
        || document.referrer.startsWith('android-app://')
        || window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true;
    } catch { v = false; }
    cached = v;
    return v;
  };
})();

export function registerWebApp() {
  inApp(); // remember "opened from the app" before the address changes
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

// ---------- Download App popup ----------
const POPUP_KEY = '99x_app_popup_at';
const POPUP_EVERY_MS = 24 * 3600 * 1000; // shown by itself at most once a day

/** The popup: opens from the menu, and by itself once a day for Android phones in the browser. */
export function useDownloadApp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (inApp() || !isAndroid()) return;
    let last = 0;
    try { last = Number(localStorage.getItem(POPUP_KEY)) || 0; } catch { /* ignore */ }
    if (Date.now() - last < POPUP_EVERY_MS) return;
    const id = window.setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem(POPUP_KEY, String(Date.now())); } catch { /* ignore */ }
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);
  return { open, show: () => setOpen(true), close: () => setOpen(false), available: !inApp() };
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nv-card2 text-[12px] font-bold text-white">{n}</span>
      <span className="pt-0.5 text-[13px] leading-relaxed text-nv-text">{children}</span>
    </li>
  );
}
const Key = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-white">{children}</strong>;
const Ico = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex h-6 w-6 translate-y-1.5 items-center justify-center rounded-md bg-nv-card2 text-white">{children}</span>
);

export function DownloadAppPopup({ onClose }: { onClose: () => void }) {
  const ios = isIOS();
  const [state, setState] = useState<'idle' | 'checking' | 'started' | 'missing'>('idle');

  // Direct download of the APK. Checks first that the file is really there (a missing file would
  // otherwise download the website page under the name 99xmatka.apk).
  const download = async () => {
    setState('checking');
    try {
      const r = await fetch(APK_URL, { method: 'HEAD', cache: 'no-store' });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || type.includes('text/html')) { setState('missing'); return; }
    } catch { /* offline check failed: try the download anyway */ }
    const a = document.createElement('a');
    a.href = `${APK_URL}?v=${Date.now()}`;
    a.download = '99xmatka.apk';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
    setState('started');
  };

  return (
    <div className="nv-fade fixed inset-0 z-[80] flex items-end justify-center bg-black/70 font-nv sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label="Download the app" className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-nv-panel shadow-2xl ring-1 ring-white/5 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="nv-tap absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-nv-mute hover:bg-nv-card2 hover:text-white"><X className="h-5 w-5" /></button>
        <div className="flex flex-col items-center bg-gradient-to-b from-nv-blue/25 to-transparent px-6 pb-4 pt-7 text-center">
          <img src="/icons/icon-192.png" alt="" className="h-20 w-20 rounded-2xl shadow-lg ring-1 ring-white/10" />
          <h3 className="mt-4 text-[19px] font-bold text-white">Get the 99xmatka app</h3>
          <p className="mt-1 text-[13px] text-nv-text">All games, faster, with alerts for deposits, withdrawals, wins and results.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 px-5 pb-4 text-center">
          {[[Zap, 'Opens instantly'], [BellRing, 'Phone alerts'], [ShieldCheck, 'Same account']].map(([Icon, label]) => {
            const I = Icon as typeof Zap;
            return (
              <div key={label as string} className="rounded-lg bg-nv-input/70 px-2 py-2.5">
                <I className="mx-auto h-4 w-4 text-nv-gold" />
                <p className="mt-1 text-[11px] font-semibold text-nv-text">{label as string}</p>
              </div>
            );
          })}
        </div>
        <div className="px-5 pb-5">
          {ios ? (
            <div className="rounded-xl bg-nv-input/70 p-4">
              <p className="text-[13px] font-semibold text-white">On iPhone</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-nv-text">The APK is for Android phones. On iPhone, play right here in Safari, or get an app icon:</p>
              <ol className="mt-3 space-y-2.5">
                <Step n={1}>Tap <Ico><Share className="h-3.5 w-3.5" /></Ico> <Key>Share</Key> in Safari.</Step>
                <Step n={2}>Tap <Ico><SquarePlus className="h-3.5 w-3.5" /></Ico> <Key>Add to Home Screen</Key>, then <Key>Add</Key>.</Step>
              </ol>
            </div>
          ) : (
            <>
              <button onClick={download} disabled={state === 'checking'}
                className="nv-tap flex w-full items-center justify-center gap-2 rounded-lg bg-nv-blue py-3.5 text-[15px] font-bold text-white shadow-lg transition-colors hover:bg-nv-blue2 disabled:opacity-70">
                <Download className="h-5 w-5" /> {state === 'checking' ? 'Starting…' : 'Download APK'}
              </button>
              {state === 'started' && (
                <p className="mt-3 text-center text-[12.5px] text-nv-green">Downloading… Open 99xmatka.apk from your notifications or Downloads and tap Install.</p>
              )}
              {state === 'missing' && (
                <p className="mt-3 text-center text-[12.5px] text-nv-red">The app file isn't available right now. Please try again later or contact support.</p>
              )}
              <p className="mt-3 text-center text-[11.5px] leading-relaxed text-nv-mute">
                For Android. If your phone asks, allow <span className="text-nv-text">Install unknown apps</span> for your browser.
              </p>
            </>
          )}
        </div>
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
    if (!pushSupported()) { setState(isIOS() && !inApp() ? 'install-first' : 'unsupported'); return; }
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
    if (!pushSupported()) { setState(isIOS() && !inApp() ? 'install-first' : 'unsupported'); return; }
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
