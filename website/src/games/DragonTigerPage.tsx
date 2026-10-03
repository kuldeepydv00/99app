import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { gamesGet, gamesPost } from './api';
import { inr, clock, useServerNow, CountdownRing, StatusPill, AmountPicker, Sheet, SUITS, cardParts, DT_SIDES, OptionTag } from './ui';
import type { Balances } from './TradingPage';

// Dragon Tiger: 1-minute rounds. The rule (lower total bet of Dragon and Tiger wins; a Tie comes
// at random about 1 round in 20) comes from the server and is shown on this screen and in "How it works".

type Round = { roundId: string; start: number; lock: number; end: number; status: string };
type Receipt = {
  roundId: string; result: string; winningTotal: number; tiedCount: number; end: number;
  cards: { dragon: string; tiger: string } | null; randomTie: boolean; sides: { DRAGON: number; TIGER: number };
};
type State = {
  label: string; serverTime: number; enabled: boolean; payout: number; minBet: number; maxBet: number;
  options: string[]; round: Round; lastResults: Receipt[]; ruleLine: string; rules: string[];
  payouts: Record<string, number>; tiePayout: number; tieChance: number; tieOneIn: number;
};
type Bet = { id: string; roundId: string; option: string; amount: number; multiplier: number; status: string; win_amount: number; result: string | null; created_at: string };

const GAME = 'dragontiger';
const BOARD = ['DRAGON', 'TIE', 'TIGER'] as const;

function PlayingCard({ code, faceDown, glow, animate }: { code?: string | null; faceDown?: boolean; glow?: string | null; animate?: boolean }) {
  const dims = 'h-[7.6rem] w-[5.4rem] sm:h-36 sm:w-[6.4rem]';
  if (!code || faceDown) {
    return (
      <div className={`${dims} flex items-center justify-center rounded-xl border-2 border-[#C9A87C]/60 shadow-xl`}
        style={{ background: 'repeating-linear-gradient(45deg,#123A2C 0 7px,#0C241B 7px 14px)' }}>
        <span className="rounded-full border border-[#C9A87C]/60 bg-[#0A0F0D]/80 px-2 py-1 text-[11px] font-black tracking-widest text-[#E0C9A0]">99x</span>
      </div>
    );
  }
  const { rank, suit } = cardParts(code);
  const s = SUITS[suit];
  const style: CSSProperties | undefined = glow ? { boxShadow: `0 0 0 3px ${glow}, 0 0 34px ${glow}` } : undefined;
  return (
    <div className={`${dims} relative rounded-xl bg-gradient-to-br from-[#FFFDF7] to-[#E9DFD0] font-extrabold shadow-2xl ${s?.red ? 'text-[#D8263F]' : 'text-[#0A0F0D]'} ${animate ? 'g-flip' : ''}`} style={style}>
      <span className="absolute left-2 top-1.5 flex flex-col items-center leading-none"><span className="text-xl">{rank}</span><span className="text-base">{s?.sym}</span></span>
      <span className="absolute inset-0 flex items-center justify-center text-5xl">{s?.sym}</span>
      <span className="absolute bottom-1.5 right-2 flex rotate-180 flex-col items-center leading-none"><span className="text-xl">{rank}</span><span className="text-base">{s?.sym}</span></span>
    </div>
  );
}

function Bead({ result, small }: { result: string; small?: boolean }) {
  const d = DT_SIDES[result];
  return (
    <span className={`flex items-center justify-center rounded-full font-black text-white ${small ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'}`} style={{ background: d?.hex || '#555' }}>
      {d?.short || '?'}
    </span>
  );
}

function resultLine(r: Receipt, tieOneIn: number) {
  if (r.randomTie) return `Tie, picked at random (about 1 in ${tieOneIn || 20} rounds)`;
  const d = r.sides?.DRAGON ?? 0, t = r.sides?.TIGER ?? 0;
  if (r.tiedCount > 1) return `Dragon ${inr(d)} = Tiger ${inr(t)} · equal, picked at random`;
  return `Dragon ${inr(d)} · Tiger ${inr(t)} · lower bet won`;
}

export default function DragonTigerPage({ mobile, balance, onBack, onBalances }: {
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
  const [reveal, setReveal] = useState<{ receipt: Receipt; won: number; staked: number } | null>(null);

  const lastSeen = useRef<string | null>(null);
  const refreshedFor = useRef<string | null>(null);

  const loadBets = useCallback(async () => {
    if (!mobile) return [] as Bet[];
    try {
      const d = await gamesGet<{ bets: Bet[] }>(`/api/games/trading/${GAME}/my-bets?mobile=${mobile}`);
      setMyBets(d.bets || []);
      return d.bets || [];
    } catch { return [] as Bet[]; }
  }, [mobile]);

  const load = useCallback(async () => {
    try {
      const d = await gamesGet<State>(`/api/games/trading/${GAME}/state`);
      setSt(d);
      setLoadError('');
      setAmount(a => Math.max(a, d.minBet));
      const newest = d.lastResults[0];
      if (newest) {
        if (lastSeen.current && lastSeen.current !== newest.roundId) {
          const bets = await loadBets();
          const mine = bets.filter(b => b.roundId === newest.roundId);
          const won = mine.filter(b => b.status === 'won').reduce((s, b) => s + (b.win_amount || 0), 0);
          setReveal({ receipt: newest, won, staked: mine.reduce((s, b) => s + b.amount, 0) });
        }
        lastSeen.current = newest.roundId;
      }
    } catch (e: any) {
      setLoadError(e.message || 'Could not load the game');
    }
  }, [loadBets]);

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

  useEffect(() => { if (reveal) { const id = setTimeout(() => setReveal(null), 7000); return () => clearTimeout(id); } }, [reveal]);

  const locked = !!st && now >= st.round.lock;
  const roundBets = useMemo(() => myBets.filter(b => st && b.roundId === st.round.roundId), [myBets, st]);
  const pastBets = useMemo(() => myBets.filter(b => st && b.roundId !== st.round.roundId).slice(0, 20), [myBets, st]);
  const myStake = useMemo(() => {
    const m: Record<string, number> = {};
    roundBets.forEach(b => { m[b.option] = (m[b.option] || 0) + b.amount; });
    return m;
  }, [roundBets]);

  // Bead road: oldest to newest, 6 per column
  const beads = useMemo(() => {
    const list = (st?.lastResults || []).slice(0, 60).reverse();
    const cols: Receipt[][] = [];
    list.forEach((r, i) => { if (i % 6 === 0) cols.push([]); cols[cols.length - 1].push(r); });
    return cols;
  }, [st]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { DRAGON: 0, TIGER: 0, TIE: 0 };
    (st?.lastResults || []).slice(0, 60).forEach(r => { c[r.result] = (c[r.result] || 0) + 1; });
    return c;
  }, [st]);

  const toggle = (o: string) => {
    if (locked) return;
    setMsg(null);
    setSelected(s => (s.includes(o) ? s.filter(x => x !== o) : [...s, o]));
  };

  const total = selected.length * amount;
  const payOf = (o: string) => (st?.payouts?.[o] ?? (o === 'TIE' ? st?.tiePayout : st?.payout) ?? 0);

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
      setMsg({ ok: true, text: `Bet placed on ${selected.map(o => DT_SIDES[o]?.name || o).join(' + ')} · ${inr(total)}` });
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
        <p className="text-sm text-gray-400">{loadError || 'Loading Dragon Tiger…'}</p>
        <button onClick={onBack} className="text-xs font-bold text-[#E0C9A0]">← Back</button>
      </div>
    );
  }

  const last = st.lastResults[0];
  const showing = reveal?.receipt || null;
  const winner = showing?.result || null;
  const winGlow = winner ? DT_SIDES[winner]?.hex : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#06120C] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-800/80 bg-[#0A0F0D]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 text-gray-300 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h2 className="text-base font-black tracking-wide">Dragon Tiger</h2>
            <p className="text-[10px] font-semibold text-[#E0C9A0]">Dragon / Tiger {st.payout}x · Tie {st.tiePayout}x</p>
          </div>
        </div>
        <span className="rounded-full border border-[#C9A87C]/40 bg-[#0C241B] px-3 py-1 text-xs font-extrabold tabular-nums text-[#F0DDB8]">{inr(balance)}</span>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 pb-48 pt-4">
        {!st.enabled && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-300">This game is paused right now.</div>
        )}

        {/* Table */}
        <div className="g-rise relative overflow-hidden rounded-3xl border border-[#C9A87C]/30 px-3 pb-4 pt-3"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 18% 45%, rgba(226,59,82,.30), transparent 70%), radial-gradient(ellipse 60% 80% at 82% 45%, rgba(76,141,255,.30), transparent 70%), linear-gradient(180deg,#0B1712,#07100C)' }}>
          <div className="mb-2 flex items-center justify-between">
            <StatusPill status={locked ? 'locked' : 'open'} />
            <span className="font-mono text-[11px] text-gray-400">{st.round.roundId}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black tracking-[0.3em] text-[#FF8A98]">DRAGON</span>
              <PlayingCard key={showing ? showing.roundId + 'd' : 'down-d'} code={showing?.cards?.dragon} faceDown={!showing} animate={!!showing}
                glow={showing && winner === 'DRAGON' ? winGlow : showing && winner === 'TIE' ? DT_SIDES.TIE.hex : null} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <CountdownRing now={now} start={st.round.start} lock={st.round.lock} end={st.round.end} size={90} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black tracking-[0.3em] text-[#8DB7FF]">TIGER</span>
              <PlayingCard key={showing ? showing.roundId + 't' : 'down-t'} code={showing?.cards?.tiger} faceDown={!showing} animate={!!showing}
                glow={showing && winner === 'TIGER' ? winGlow : showing && winner === 'TIE' ? DT_SIDES.TIE.hex : null} />
            </div>
          </div>
          <div className="mt-3 min-h-[2.75rem] text-center">
            {showing ? (
              <div className="g-pop">
                <p className="text-lg font-black tracking-wide" style={{ color: winGlow || '#fff' }}>
                  {winner === 'TIE' ? 'TIE!' : `${DT_SIDES[winner || '']?.name.toUpperCase()} WINS`}
                </p>
                {reveal && reveal.won > 0
                  ? <p className="text-sm font-black text-[#3EE08A]">You won {inr(reveal.won)}!</p>
                  : reveal && reveal.staked > 0
                    ? <p className="text-[11px] text-gray-400">Not this time</p>
                    : <p className="text-[11px] text-gray-500">{resultLine(showing, st.tieOneIn)}</p>}
                <p className="mt-0.5 font-mono text-[10px] text-gray-500">Result of {showing.roundId}</p>
              </div>
            ) : locked ? (
              <p className="animate-pulse pt-2 text-xs font-bold text-[#E0C9A0]">Dealing the cards… result in {clock(st.round.end - now)}</p>
            ) : (
              <p className="pt-2 text-xs font-bold text-gray-300">Place your bets · closes in {clock(st.round.lock - now)}</p>
            )}
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
              <p className="font-mono text-gray-500">{last.roundId}{last.cards ? ` · ${last.cards.dragon} vs ${last.cards.tiger}` : ''}</p>
              <p className="mt-0.5 truncate">{resultLine(last, st.tieOneIn)}</p>
            </div>
            <OptionTag game={GAME} value={last.result} size="lg" />
          </div>
        )}

        {/* Betting board */}
        <div className="relative">
          <div className="grid grid-cols-[1fr_0.8fr_1fr] gap-2.5">
            {BOARD.map(o => {
              const d = DT_SIDES[o];
              const on = selected.includes(o);
              return (
                <button key={o} onClick={() => toggle(o)}
                  className={`relative flex h-32 flex-col items-center justify-center rounded-2xl ${d.bg} text-white shadow-xl transition-all duration-150 active:scale-95 ${on ? 'scale-[1.02] ring-[3px] ring-white/90' : 'opacity-85 hover:opacity-100'}`}>
                  <span className={`font-black drop-shadow ${o === 'TIE' ? 'text-base' : 'text-lg'}`}>{d.name.toUpperCase()}</span>
                  <span className="mt-0.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-extrabold">{payOf(o)}x</span>
                  {myStake[o] ? <span className="absolute bottom-2 rounded-full bg-[#F0DDB8] px-2 py-0.5 text-[10px] font-black text-[#0A0F0D]">You: {inr(myStake[o])}</span> : null}
                  {on && !myStake[o] && <span className="absolute bottom-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-extrabold">Picked</span>}
                </button>
              );
            })}
          </div>
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#06120C]/80 backdrop-blur-[2px]">
              <div className="text-center">
                <p className="text-sm font-extrabold text-white">🔒 Betting closed for this round</p>
                <p className="mt-1 font-mono text-xs text-gray-400">Result in {clock(st.round.end - now)} · next round opens then</p>
              </div>
            </div>
          )}
        </div>

        <AmountPicker value={amount} onChange={setAmount} min={st.minBet} max={st.maxBet} />

        {/* Bead road */}
        {beads.length > 0 && (
          <div className="rounded-2xl border border-gray-800 bg-[#0A0F0D] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-white">Last {Math.min(60, st.lastResults.length)} results</p>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="flex items-center gap-1 text-[#FF8A98]"><Bead result="DRAGON" small /> {counts.DRAGON}</span>
                <span className="flex items-center gap-1 text-[#8DB7FF]"><Bead result="TIGER" small /> {counts.TIGER}</span>
                <span className="flex items-center gap-1 text-[#3EE08A]"><Bead result="TIE" small /> {counts.TIE}</span>
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
        <div className="mx-auto max-w-md space-y-2">
          {msg && <p className={`text-center text-xs font-bold ${msg.ok ? 'text-[#3EE08A]' : 'text-[#FF6B7E]'}`}>{msg.text}</p>}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{selected.length === 0 ? 'Tap Dragon, Tie or Tiger' : selected.map(o => DT_SIDES[o]?.name).join(' + ') + ` × ${inr(amount)}`}</span>
            <span className="font-bold text-white">Total <span className="tabular-nums text-[#F0DDB8]">{inr(total)}</span></span>
          </div>
          {selected.length > 0 && (
            <p className="text-center text-[10px] text-gray-500">
              If it wins: {selected.map(o => `${DT_SIDES[o]?.name} ${inr(amount * payOf(o))}`).join(' · ')}
            </p>
          )}
          <button onClick={place} disabled={selected.length === 0 || placing || locked || !st.enabled}
            className="w-full rounded-xl bg-gradient-to-r from-[#F0DDB8] via-[#E0C9A0] to-[#C9A87C] py-3.5 text-sm font-extrabold tracking-wide text-[#0A0F0D] shadow-lg shadow-[#C9A87C]/20 transition-transform active:scale-[0.98] disabled:opacity-40">
            {placing ? 'Placing…' : locked ? 'Betting closed' : 'PLACE BET'}
          </button>
        </div>
      </div>

      {/* Rules */}
      <Sheet open={showRules} onClose={() => setShowRules(false)} title="How Dragon Tiger works">
        <ul className="space-y-2.5 text-xs leading-relaxed text-gray-300">
          {st.rules.map((line, i) => (
            <li key={i} className="flex gap-2"><span className="text-[#C9A87C]">•</span><span>{line}</span></li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
