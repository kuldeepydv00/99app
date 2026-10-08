import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Info, ShieldCheck, Wallet, X } from 'lucide-react';

// Casino game kit (navy theme, Stake-style): full-screen game page, bet panel + game area,
// the bet amount box, buttons, fields, the footer bar under a game, a modal and a bets table.

export const rupees = (n: number | null | undefined, dp = 2) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const short = (n: number) => (n >= 1000 ? `${n % 1000 === 0 ? n / 1000 : (n / 1000).toFixed(1)}K` : String(n));

/** Full-screen game page: top bar (back, title, balance) and a centred content column. */
export function GameScreen({ title, kicker = '99x Originals', balance, onBack, children, tone }: {
  title: string; kicker?: string; balance: number; onBack: () => void; children: ReactNode; tone?: string;
}) {
  return (
    <div className="nv-fade fixed inset-0 z-50 overflow-y-auto bg-nv-bg font-nv text-white antialiased" style={tone ? { boxShadow: `inset 0 0 0 0 ${tone}` } : undefined}>
      <header className="sticky top-0 z-30 border-b border-black/30 bg-nv-side/95 shadow-[0_4px_14px_rgba(0,0,0,0.3)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-3 sm:px-6">
          <button onClick={onBack} aria-label="Back"
            className="nv-tap flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-nv-card text-nv-text transition-colors hover:bg-nv-card2 hover:text-white">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-bold text-white">{title}</p>
            <p className="truncate text-[11px] font-medium text-nv-mute">{kicker}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-nv-input px-3 py-2 text-[13px] font-semibold tabular-nums text-white ring-1 ring-nv-edge">
            <Wallet className="h-4 w-4 text-nv-mute" />{rupees(balance)}
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1200px] px-3 pb-16 pt-3 sm:px-6 sm:pt-5">{children}</div>
    </div>
  );
}

/** The game box: bet panel on the left (below the game on phones), game area on the right, footer bar under both. */
export function GameBox({ panel, stage, footer, stageClass = '' }: { panel: ReactNode; stage: ReactNode; footer?: ReactNode; stageClass?: string }) {
  return (
    <div className="overflow-hidden rounded-lg bg-nv-panel shadow-[0_8px_24px_rgba(0,0,0,0.3)] ring-1 ring-white/[0.04]">
      <div className="flex flex-col-reverse lg:flex-row">
        <div className="w-full shrink-0 space-y-3 p-3 sm:p-4 lg:w-[340px]">{panel}</div>
        <div className={`relative min-w-0 flex-1 bg-nv-input lg:min-h-[520px] ${stageClass}`}>{stage}</div>
      </div>
      {footer}
    </div>
  );
}

export function Field({ label, right, children }: { label: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px] font-semibold text-nv-text sm:text-[12.5px]">
        <span className="truncate">{label}</span>
        {right !== undefined && <span className="tabular-nums text-nv-mute">{right}</span>}
      </div>
      {children}
    </div>
  );
}

/** Read-only value box (e.g. Profit on Win). */
export function ReadBox({ children, tone = 'text-white' }: { children: ReactNode; tone?: string }) {
  return (
    <div className={`flex h-11 items-center rounded-md bg-nv-input px-3 text-[14px] font-semibold tabular-nums ring-1 ring-nv-edge ${tone}`}>
      {children}
    </div>
  );
}

export const AMOUNT_QUICK = [10, 50, 100, 500, 1000, 5000];

/**
 * Bet amount box: type any whole-rupee amount, ½ and 2× buttons, quick amounts and Max.
 * The amount always stays inside [min, max]; Max and 2× also stay inside the balance.
 */
export function BetAmount({ value, onChange, min, max, balance, disabled = false, label = 'Bet Amount', note }: {
  value: number; onChange: (v: number) => void; min: number; max: number; balance: number; disabled?: boolean; label?: string; note?: ReactNode;
}) {
  const [text, setText] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(String(value)); }, [value, focus]);

  const cap = Math.max(min, Math.min(max, Math.floor(balance)));
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.floor(v) || min));
  const set = (v: number) => { const c = clamp(v); onChange(c); setText(String(c)); };
  const typed = parseInt(text || '0', 10) || 0;
  const over = value > balance + 0.001;

  const btn = 'nv-tap flex h-full items-center justify-center px-3 text-[13px] font-bold text-white transition-colors hover:bg-nv-edge disabled:opacity-40';
  return (
    <Field label={label} right={rupees(balance)}>
      <div className={`flex h-11 overflow-hidden rounded-md bg-nv-edge/60 ring-1 ${over ? 'ring-nv-red/70' : 'ring-nv-edge'} ${disabled ? 'opacity-60' : ''}`}>
        <label className="flex min-w-0 flex-1 items-center gap-1.5 bg-nv-input px-3">
          <span className="text-[14px] font-semibold text-nv-mute">₹</span>
          <input value={text} disabled={disabled} inputMode="numeric" aria-label={label}
            onFocus={e => { setFocus(true); e.currentTarget.select(); }}
            onChange={e => {
              const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 9);
              setText(digits);
              const v = parseInt(digits || '0', 10);
              if (v >= min && v <= max) onChange(v);
            }}
            onBlur={() => { setFocus(false); set(typed); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold tabular-nums text-white focus:outline-none" />
        </label>
        <button disabled={disabled} onClick={() => set(value / 2)} className={btn} aria-label="Half">½</button>
        <span className="my-2.5 w-px bg-nv-mute/30" />
        <button disabled={disabled} onClick={() => set(Math.min(value * 2, Math.max(cap, value)))} className={btn} aria-label="Double">2×</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {AMOUNT_QUICK.map(a => (
          <button key={a} disabled={disabled || a < min || a > max} onClick={() => set(a)}
            className={`nv-tap h-8 rounded-md text-[12px] font-semibold tabular-nums transition-colors disabled:opacity-30 ${value === a ? 'bg-nv-blue text-white' : 'bg-nv-input text-nv-text ring-1 ring-nv-edge hover:bg-nv-edge hover:text-white'}`}>
            {short(a)}
          </button>
        ))}
        <button disabled={disabled} onClick={() => set(cap)}
          className="nv-tap h-8 rounded-md bg-nv-input text-[12px] font-semibold text-nv-text ring-1 ring-nv-edge transition-colors hover:bg-nv-edge hover:text-white disabled:opacity-30">
          Max
        </button>
      </div>
      <p className={`mt-1.5 text-[11px] ${over ? 'font-semibold text-nv-red' : 'text-nv-dim'}`}>
        {over ? `Not enough balance for ${rupees(value, 0)}` : note ?? `Min ${rupees(min, 0)} · Max ${rupees(max, 0)}`}
      </p>
    </Field>
  );
}

/** Main action button. */
export function PlayButton({ children, onClick, disabled, tone = 'blue', busy }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'blue' | 'green' | 'grey'; busy?: boolean;
}) {
  const t = tone === 'green' ? 'bg-nv-green text-[#05210F] hover:brightness-110' : tone === 'grey' ? 'bg-nv-edge text-white hover:bg-nv-line' : 'bg-nv-blue text-white hover:bg-nv-blue2';
  return (
    <button onClick={onClick} disabled={disabled || busy}
      className={`nv-tap flex h-12 w-full items-center justify-center rounded-md text-[15px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${t}`}>
      {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : children}
    </button>
  );
}

/** Two or three choices side by side (e.g. Roll Over / Roll Under). */
export function Segmented<T extends string>({ options, value, onChange, disabled }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="flex rounded-full bg-nv-input p-1 ring-1 ring-nv-edge">
      {options.map(o => (
        <button key={o.value} disabled={disabled} onClick={() => onChange(o.value)}
          className={`nv-tap flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 ${value === o.value ? 'bg-nv-card2 text-white shadow' : 'text-nv-text hover:text-white'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Message line under the bet button. */
export function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`rounded-md px-3 py-2 text-center text-[12.5px] font-semibold ${msg.ok ? 'bg-nv-green/10 text-nv-green' : 'bg-nv-red/10 text-nv-red'}`}>{msg.text}</p>;
}

/** Bar under the game box: rules and fairness buttons, the game name. */
export function GameFooter({ name, onRules, onFairness, extra }: { name: string; onRules: () => void; onFairness?: () => void; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-black/30 bg-nv-panel px-3 py-2.5 sm:px-4">
      <button onClick={onRules} aria-label="How to play"
        className="nv-tap flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold text-nv-text transition-colors hover:bg-nv-card2 hover:text-white">
        <Info className="h-4 w-4" /><span className="hidden sm:inline">How to play</span>
      </button>
      {extra}
      <span className="mx-auto truncate text-[13px] font-bold text-white/80"><span className="text-nv-gold">99x</span> {name}</span>
      {onFairness ? (
        <button onClick={onFairness}
          className="nv-tap flex h-9 items-center gap-1.5 rounded-md bg-nv-card2 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-nv-line">
          <ShieldCheck className="h-4 w-4 text-nv-green" />Fairness
        </button>
      ) : <span className="w-9" />}
    </div>
  );
}

/** Modal: bottom sheet on phones, centred box on bigger screens. */
export function NvModal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="nv-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/70 font-nv backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`g-sheet max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-nv-panel p-5 pb-7 shadow-2xl ring-1 ring-white/5 sm:rounded-xl ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-bold text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="nv-tap flex h-8 w-8 items-center justify-center rounded-md bg-nv-input text-nv-text hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RulesList({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-2.5 text-[13px] leading-relaxed text-nv-text">
      {lines.map((l, i) => <li key={i} className="flex gap-2.5"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-nv-blue2" /><span>{l}</span></li>)}
    </ul>
  );
}

export type HistoryRow = { id: string; what: ReactNode; amount: number; multiplier?: number | null; payout: number; status: string; at?: string };

/** "My bets" table under a game. */
export function BetsTable({ rows, title = 'My bets', empty = 'Your bets on this game will show here.' }: { rows: HistoryRow[]; title?: string; empty?: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg bg-nv-panel ring-1 ring-white/[0.04]">
      <p className="border-b border-black/30 px-4 py-3 text-[14px] font-semibold text-white">{title}</p>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-nv-mute">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[12.5px]">
            <thead>
              <tr className="text-left text-nv-mute">
                <th className="px-4 py-2 font-semibold">Bet</th>
                <th className="px-2 py-2 text-right font-semibold">Amount</th>
                <th className="px-2 py-2 text-right font-semibold">Multiplier</th>
                <th className="px-4 py-2 text-right font-semibold">Payout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const win = r.status === 'won';
                return (
                  <tr key={r.id} className={i % 2 ? 'bg-nv-input/40' : ''}>
                    <td className="px-4 py-2.5 text-white">{r.what}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-nv-text">{rupees(r.amount)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-nv-text">{r.multiplier ? `${r.multiplier.toFixed(2)}×` : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${win ? 'text-nv-green' : r.status === 'pending' ? 'text-amber-300' : r.status === 'refunded' ? 'text-sky-300' : 'text-nv-mute'}`}>
                      {r.status === 'pending' ? 'Open' : r.status === 'refunded' ? 'Refunded' : win ? `+${rupees(r.payout)}` : `-${rupees(r.amount)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Small "paused" banner. */
export function PausedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="mb-3 rounded-md bg-amber-400/10 px-3 py-2 text-[12.5px] font-semibold text-amber-300 ring-1 ring-amber-400/30">This game is paused right now.</p>;
}

/** Phone-only bar pinned to the bottom with the bet total and the main button (bet panel sits below the game on phones). */
export function MobileBetBar({ show, label, button, onClick, disabled, busy }: {
  show: boolean; label: ReactNode; button: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/40 bg-nv-side/95 px-3 pt-2.5 shadow-[0_-6px_18px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1 text-[12.5px] text-nv-text">{label}</div>
        <button onClick={onClick} disabled={disabled || busy}
          className="nv-tap h-11 shrink-0 rounded-md bg-nv-blue px-5 text-[14px] font-bold text-white transition hover:bg-nv-blue2 disabled:opacity-50">
          {busy ? '…' : button}
        </button>
      </div>
    </div>
  );
}

/** Round timer for the bet panel: ring, open / closed state, round number and the rule line. */
export function RoundInfo({ ring, locked, roundId, ruleLine, onRules }: {
  ring: ReactNode; locked: boolean; roundId: string; ruleLine?: string; onRules?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-nv-input p-3 ring-1 ring-nv-edge">
      {ring}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {locked
            ? <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] font-semibold text-nv-mute">Betting closed</span>
            : <span className="inline-flex items-center gap-1 rounded bg-nv-green/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-nv-green"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-nv-green" />Betting open</span>}
          <span className="truncate font-mono text-[10.5px] text-nv-dim">{roundId}</span>
        </div>
        {ruleLine && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-nv-text">{ruleLine}</p>}
        {onRules && <button onClick={onRules} className="mt-0.5 text-[11.5px] font-semibold text-nv-blue2 hover:text-white">How it works</button>}
      </div>
    </div>
  );
}

/** Result pop-up after a round settles. */
export function ResultPop({ show, onClose, title, children, won }: { show: boolean; onClose: () => void; title: string; children: ReactNode; won: number }) {
  if (!show) return null;
  return (
    <div className="nv-fade fixed inset-0 z-[80] flex items-center justify-center bg-black/70 font-nv backdrop-blur-[2px]" onClick={onClose}>
      <div className={`g-pop w-72 rounded-xl bg-nv-panel p-6 text-center shadow-2xl ring-2 ${won > 0 ? 'ring-nv-green' : 'ring-nv-edge'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-nv-mute">{title}</p>
        <div className="mt-4 flex justify-center">{children}</div>
        {won > 0
          ? <p className="mt-4 text-[18px] font-bold text-nv-green">You won {rupees(won)}</p>
          : <p className="mt-4 text-[12px] text-nv-mute">Tap to close</p>}
      </div>
    </div>
  );
}
