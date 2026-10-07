import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { gamesGet, gamesPost } from './api';
import { inr, clock, useServerNow, CountdownRing, StatusPill, AmountPicker, Sheet, TOSS_SIDES, OptionTag } from './ui';
import type { Balances } from './TradingPage';
import { TossCoin, TossStyle, CoinFace, faceAngle } from './TossCoin';
import type { CoinPhase } from './TossCoin';

// Toss: Head or Tail, 1-minute rounds. The rule (the side with the lower total bet wins; equal totals
// are picked at random) comes from the server and is shown here and in "How it works".

type Round = { roundId: string; start: number; lock: number; end: number; status: string };
type Receipt = { roundId: string; result: string; winningTotal: number; tiedCount: number; end: number; sides?: { HEAD: number; TAIL: number } };
type State = {
  label: string; serverTime: number; enabled: boolean; payout: number; minBet: number; maxBet: number;
  options: string[]; round: Round; lastResults: Receipt[]; ruleLine: string; rules: string[];
};
type Bet = { id: string; roundId: string; option: string; amount: number; multiplier: number; status: string; win_amount: number; result: string | null; created_at: string };

const GAME = 'toss';
const SIDES = ['HEAD', 'TAIL'] as const;
const FLIP_MS = 2300;
const SHOW_MS = 6500;

function Bead({ result, small }: { result: string; small?: boolean }) {
  const d = TOSS_SIDES[result];
  return (
    <span className={`flex items-center justify-center rounded-full font-black text-white ring-1 ring-[#FFE48A]/40 ${small ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'}`} style={{ background: d?.hex || '#555' }}>
      {d?.short || '?'}
    </span>
  );
}

function resultLine(r: Receipt) {
  const h = r.sides?.HEAD ?? 0, t = r.sides?.TAIL ?? 0;
  if (r.tiedCount > 1) return `Head ${inr(h)} = Tail ${inr(t)} · equal, picked at random`;
  return `Head ${inr(h)} · Tail ${inr(t)} · lower bet won`;
}

export default function TossPage({ mobile, balance, onBack, onBalances }: {
  mobile: string; balance: number; onBack: () => void; onBalances: (b: Balances) => void;
}) {
  const [st, setSt] = useState<State | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState(10);
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [showRules, setShowRules] = useState(false);
  // The coin: which face is up (`from`), and an active toss (`phase` + `end`) with its result
  const [coin, setCoin] = useState<{ phase: 'flip' | 'landed' | null; from: number; end: number; key: string; receipt: Receipt | null; won: number; staked: number }>(
    { phase: null, from: 0, end: 0, key: '', receipt: null, won: 0, staked: 0 }
  );

  const lastSeen = useRef<string | null>(null);
  const refreshedFor = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const loadBets = useCallback(async () => {
    if (!mobile) return [] as Bet[];
    try {
      const d = await gamesGet<{ bets: Bet[] }>(`/api/games/trading/${GAME}/my-bets?mobile=${mobile}`);
      setMyBets(d.bets || []);
      return d.bets || [];
    } catch { return [] as Bet[]; }
  }, [mobile]);

  const startToss = useCallback((receipt: Receipt, won: number, staked: number) => {
    timers.current.forEach(clearTimeout);
    const target = faceAngle(receipt.result);
    setCoin(c => {
      const from = ((c.phase ? c.end : c.from) % 360 + 360) % 360;
      return { phase: 'flip', from, end: from + 1800 + ((target - from + 360) % 360), key: receipt.roundId, receipt, won, staked };
    });
    timers.current = [
      window.setTimeout(() => setCoin(c => ({ ...c, phase: 'landed' })), FLIP_MS),
      window.setTimeout(() => setCoin(c => ({ ...c, phase: null, from: target, end: target })), FLIP_MS + SHOW_MS)
    ];
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await gamesGet<State>(`/api/games/trading/${GAME}/state`);
      setSt(d);
      setLoadError('');
      setAmount(a => Math.max(a, d.minBet));
      const newest = d.lastResults[0];
      if (newest) {
        if (lastSeen.current === null) {
          setCoin(c => ({ ...c, from: faceAngle(newest.result), end: faceAngle(newest.result) }));
        } else if (lastSeen.current !== newest.roundId) {
          const bets = await loadBets();
          const mine = bets.filter(b => b.roundId === newest.roundId);
          startToss(newest, mine.filter(b => b.status === 'won').reduce((s, b) => s + (b.win_amount || 0), 0), mine.reduce((s, b) => s + b.amount, 0));
        }
        lastSeen.current = newest.roundId;
      }
    } catch (e: any) {
      setLoadError(e.message || 'Could not load the game');
    }
  }, [loadBets, startToss]);

  useEffect(() => {
    load();
    loadBets();
    const id = setInterval(load, 2000);
    const id2 = setInterval(loadBets, 15000);
    return () => { clearInterval(id); clearInterval(id2); };
  }, [load, loadBets]);

  const now = useServerNow(st?.serverTime);

  useEffect(() => {
    if (st && now >= st.round.end && refreshedFor.current !== st.round.roundId) {
      refreshedFor.current = st.round.roundId;
      setTimeout(load, 1200);
    }
  }, [now, st, load]);

  const locked = !!st && now >= st.round.lock;
  const roundBets = useMemo(() => myBets.filter(b => st && b.roundId === st.round.roundId), [myBets, st]);
  const pastBets = useMemo(() => myBets.filter(b => st && b.roundId !== st.round.roundId).slice(0, 20), [myBets, st]);
  const myStake = useMemo(() => {
    const m: Record<string, number> = {};
    roundBets.forEach(b => { m[b.option] = (m[b.option] || 0) + b.amount; });
    return m;
  }, [roundBets]);
  const beads = useMemo(() => {
    const list = (st?.lastResults || []).slice(0, 60).reverse();
    const cols: Receipt[][] = [];
    list.forEach((r, i) => { if (i % 6 === 0) cols.push([]); cols[cols.length - 1].push(r); });
    return cols;
  }, [st]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { HEAD: 0, TAIL: 0 };
    (st?.lastResults || []).slice(0, 60).forEach(r => { c[r.result] = (c[r.result] || 0) + 1; });
    return c;
  }, [st]);

  const toggle = (o: string) => {
    if (locked) return;
    setMsg(null);
    setSelected(s => (s.includes(o) ? s.filter(x => x !== o) : [...s, o]));
  };
  const total = selected.length * amount;

  const place = async () => {
    if (!st || selected.length === 0 || placing) return;
    if (!mobile) { setMsg({ ok: false, text: 'Please log in to place bets.' }); return; }
    if (total > balance + 0.001) { setMsg({ ok: false, text: `Not enough balance. You need ${inr(total)}.` }); return; }
    setPlacing(true); setMsg(null);
    try {
      const d = await gamesPost<{ balances: Balances; bets: Bet[] }>(`/api/games/trading/${GAME}/bet`, {
        mobile, bets: selected.map(option => ({ option, amount }))
      });
      onBalances(d.balances);
      setMsg({ ok: true, text: `Bet placed on ${selected.map(o => TOSS_SIDES[o]?.name || o).join(' + ')} · ${inr(total)}` });
      setSelected([]);
      loadBets();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Could not place bet' });
    }
    setPlacing(false);
  };

  if (!st) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#06120C] text-white">
        <p className="text-sm text-gray-400">{loadError || 'Loading Toss…'}</p>
        <button onClick={onBack} className="text-xs font-bold text-[#E0C9A0]">← Back</button>
      </div>
    );
  }

  const last = st.lastResults[0];
  const phase: CoinPhase = coin.phase || (locked ? 'tense' : 'idle');
  const landed = coin.phase === 'landed' && coin.receipt;
  const winner = landed ? coin.receipt!.result : null;
  const winHex = winner ? TOSS_SIDES[winner]?.hex : undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#06120C] text-white">
      <TossStyle />
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-800/80 bg-[#0A0F0D]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 text-gray-300 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h2 className="text-base font-black tracking-wide">Toss</h2>
            <p className="text-[10px] font-semibold text-[#E0C9A0]">Head / Tail pay {st.payout}x</p>
          </div>
        </div>
        <span className="rounded-full border border-[#C9A87C]/40 bg-[#0C241B] px-3 py-1 text-xs font-extrabold tabular-nums text-[#F0DDB8]">{inr(balance)}</span>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 pb-48 pt-4 md:max-w-xl">
        {!st.enabled && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-300">This game is paused right now.</div>
        )}

        {/* Stage: the coin */}
        <div className="g-rise relative overflow-hidden rounded-3xl border border-[#C9A87C]/35 shadow-2xl shadow-black/60"
          style={{ background: 'radial-gradient(ellipse 45% 55% at 50% 48%, rgba(255,214,102,.22), transparent 70%), radial-gradient(ellipse 50% 80% at 8% 60%, rgba(226,59,82,.28), transparent 70%), radial-gradient(ellipse 50% 80% at 92% 60%, rgba(61,123,240,.28), transparent 70%), radial-gradient(ellipse 90% 40% at 50% 100%, rgba(30,92,70,.55), transparent 70%), linear-gradient(180deg,#0E0B0A 0%,#0A120F 60%,#06120C 100%)' }}>
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #F0DDB8 1px, transparent 1.5px), radial-gradient(circle at 75% 75%, #F0DDB8 1px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
          {landed && winHex && (
            <div key={coin.key + 'flash'} className="tc-flash pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, ${winHex}77, transparent 62%)` }} />
          )}
          <div className="relative z-10 flex items-center justify-between px-3 pt-3">
            <StatusPill status={locked ? 'locked' : 'open'} />
            <span className="font-mono text-[10px] text-gray-400">{st.round.roundId}</span>
          </div>

          <div className="relative flex items-end justify-between px-4">
            <div className="mb-10 flex w-16 flex-col items-center gap-1 opacity-90">
              <CoinFace side="HEAD" className="h-12 w-12" />
              <span className="text-[10px] font-black tracking-[0.25em] text-[#FF8A98]">HEAD</span>
            </div>
            <TossCoin key={coin.key || 'coin'} phase={phase} from={coin.from} end={coin.end} size="clamp(128px, 36vw, 176px)" glow={winHex} className="-mt-4" />
            <div className="mb-10 flex w-16 flex-col items-center gap-1 opacity-90">
              <CoinFace side="TAIL" className="h-12 w-12" />
              <span className="text-[10px] font-black tracking-[0.25em] text-[#8DB7FF]">TAIL</span>
            </div>
          </div>

          <div className="relative -mt-4 flex items-center gap-3 px-4 pb-4">
            <CountdownRing now={now} start={st.round.start} lock={st.round.lock} end={st.round.end} size={82} />
            <div className="min-h-[3.4rem] min-w-0 flex-1">
              {landed ? (
                <div className="g-pop">
                  <p className="bg-clip-text text-2xl font-black tracking-wide text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,.8)]"
                    style={{ backgroundImage: winner === 'HEAD' ? 'linear-gradient(180deg,#FFF3B0,#FDBA74 45%,#E23B52)' : 'linear-gradient(180deg,#FFF3B0,#93C5FD 45%,#3D7BF0)' }}>
                    {TOSS_SIDES[winner || '']?.name.toUpperCase()} WINS!
                  </p>
                  {coin.won > 0
                    ? <p className="text-base font-black text-[#3EE08A]">You won {inr(coin.won)}!</p>
                    : coin.staked > 0
                      ? <p className="text-[11px] text-gray-400">Not this time</p>
                      : <p className="truncate text-[11px] text-gray-400">{resultLine(coin.receipt!)}</p>}
                  <p className="font-mono text-[10px] text-gray-500">Result of {coin.receipt!.roundId}</p>
                </div>
              ) : coin.phase === 'flip' ? (
                <p className="animate-pulse text-lg font-black tracking-wide text-[#FFE48A]">Tossing…</p>
              ) : locked ? (
                <p className="animate-pulse text-sm font-bold text-[#E0C9A0]">Coin in hand… toss in {clock(st.round.end - now)}</p>
              ) : (
                <p className="text-sm font-bold text-gray-200">Place your bets · closes in {clock(st.round.lock - now)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Rule */}
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#C9A87C]/25 bg-[#0C241B] px-4 py-3">
          <p className="text-xs font-semibold leading-snug text-gray-200">{st.ruleLine}</p>
          <button onClick={() => setShowRules(true)} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#E0C9A0] hover:text-white">
            <Info className="h-3.5 w-3.5" /> How it works
          </button>
        </div>

        {/* Last result */}
        {last && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-[#0A0F0D] px-4 py-2.5">
            <div className="min-w-0 text-[11px] text-gray-400">
              <p className="font-mono text-gray-500">{last.roundId}</p>
              <p className="mt-0.5 truncate">{resultLine(last)}</p>
            </div>
            <OptionTag game={GAME} value={last.result} size="lg" />
          </div>
        )}

        {/* Bet buttons */}
        <div className="relative">
          <div className="grid grid-cols-2 gap-3">
            {SIDES.map(o => {
              const d = TOSS_SIDES[o];
              const on = selected.includes(o);
              return (
                <button key={o} onClick={() => toggle(o)}
                  className={`relative flex h-40 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/15 ${d.bg} text-white shadow-xl transition-all duration-150 active:scale-95 ${on ? 'scale-[1.02] ring-[3px] ring-[#FFF3B0]' : 'opacity-90 hover:opacity-100'}`}>
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.22),transparent_60%)]" />
                  <CoinFace side={o} className="relative h-[4.5rem] w-[4.5rem]" />
                  <span className="relative mt-2 text-xl font-black tracking-wide drop-shadow">{d.name.toUpperCase()}</span>
                  <span className="relative mt-0.5 rounded-full bg-black/35 px-2.5 py-0.5 text-[11px] font-extrabold">{st.payout}x</span>
                  {myStake[o] ? <span className="absolute left-1/2 top-1.5 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#F0DDB8] px-2 py-0.5 text-[10px] font-black text-[#0A0F0D] shadow">You: {inr(myStake[o])}</span> : null}
                  {on && <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF3B0] text-[11px] font-black text-[#0A0F0D] shadow">✓</span>}
                </button>
              );
            })}
          </div>
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#06120C]/80 backdrop-blur-[2px]">
              <div className="text-center">
                <p className="text-sm font-extrabold text-white">🔒 Betting closed for this round</p>
                <p className="mt-1 font-mono text-xs text-gray-400">Toss in {clock(st.round.end - now)} · next round opens then</p>
              </div>
            </div>
          )}
        </div>

        <AmountPicker value={amount} onChange={setAmount} min={st.minBet} max={st.maxBet} />

        {/* History */}
        {beads.length > 0 && (
          <div className="rounded-2xl border border-gray-800 bg-[#0A0F0D] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-white">Last {Math.min(60, st.lastResults.length)} tosses</p>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="flex items-center gap-1 text-[#FF8A98]"><Bead result="HEAD" small /> {counts.HEAD}</span>
                <span className="flex items-center gap-1 text-[#8DB7FF]"><Bead result="TAIL" small /> {counts.TAIL}</span>
              </div>
            </div>
            <div className="g-noscroll flex gap-1 overflow-x-auto">
              {beads.map((col, i) => (
                <div key={i} className="flex shrink-0 flex-col gap-1">
                  {col.map(r => <Bead key={r.roundId} result={r.result} />)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past bets */}
        {pastBets.length > 0 && (
          <div className="rounded-2xl border border-gray-800 bg-[#0A0F0D]">
            <p className="border-b border-gray-800 px-3 py-2 text-xs font-bold text-white">Your recent bets</p>
            {pastBets.map(b => (
              <div key={b.id} className="flex items-center justify-between border-b border-gray-900 px-3 py-2 last:border-0">
                <div className="flex items-center gap-2">
                  <OptionTag game={GAME} value={b.option} />
                  <span className="text-[11px] text-gray-400">{inr(b.amount)} · <span className="font-mono">{b.roundId.split('-').slice(1).join('-')}</span></span>
                </div>
                {b.status === 'won'
                  ? <span className="text-xs font-extrabold text-[#3EE08A]">+{inr(b.win_amount)}</span>
                  : b.status === 'lost'
                    ? <span className="flex items-center gap-1 text-[11px] text-gray-500">Result <OptionTag game={GAME} value={b.result} /></span>
                    : b.status === 'refunded'
                      ? <span className="text-[11px] font-bold text-sky-300">Refunded</span>
                      : <span className="text-[11px] font-bold text-amber-400">Pending</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bet slip */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C9A87C]/25 bg-[#0A0F0D]/95 px-4 pb-5 pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-md space-y-2 md:max-w-xl">
          {msg && <p className={`text-center text-xs font-bold ${msg.ok ? 'text-[#3EE08A]' : 'text-[#FF6B7E]'}`}>{msg.text}</p>}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{selected.length === 0 ? 'Tap Head or Tail' : selected.map(o => TOSS_SIDES[o]?.name).join(' + ') + ` × ${inr(amount)}`}</span>
            <span className="font-bold text-white">Total <span className="tabular-nums text-[#F0DDB8]">{inr(total)}</span></span>
          </div>
          {selected.length > 0 && <p className="text-center text-[10px] text-gray-500">If it wins: {inr(amount * st.payout)}</p>}
          <button onClick={place} disabled={selected.length === 0 || placing || locked || !st.enabled}
            className="w-full rounded-xl bg-gradient-to-r from-[#F0DDB8] via-[#E0C9A0] to-[#C9A87C] py-3.5 text-sm font-extrabold tracking-wide text-[#0A0F0D] shadow-lg shadow-[#C9A87C]/20 transition-transform active:scale-[0.98] disabled:opacity-40">
            {placing ? 'Placing…' : locked ? 'Betting closed' : 'PLACE BET'}
          </button>
        </div>
      </div>

      {/* Rules */}
      <Sheet open={showRules} onClose={() => setShowRules(false)} title="How Toss works">
        <ul className="space-y-2.5 text-xs leading-relaxed text-gray-300">
          {st.rules.map((line, i) => (
            <li key={i} className="flex gap-2"><span className="text-[#C9A87C]">•</span><span>{line}</span></li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
