import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { gamesGet, gamesPost } from './api';
import type { TradingGame } from './api';
import { inr, clock, useServerNow, OptionTag, CountdownRing, StatusPill, GlassCard, AmountPicker, Sheet, SUITS, cardParts, COLOURS } from './ui';

type Round = { roundId: string; start: number; lock: number; end: number; status: string };
type Receipt = { roundId: string; result: string; winningTotal: number; tiedCount: number; totalOptions: number; end: number };
type State = {
  game: TradingGame; label: string; serverTime: number; enabled: boolean; payout: number; minBet: number; maxBet: number;
  options: string[]; round: Round; lastResults: Receipt[]; ruleLine: string; rules: string[];
};
type Bet = { id: string; roundId: string; option: string; amount: number; multiplier: number; status: string; win_amount: number; result: string | null; created_at: string };
export type Balances = { balance: number; deposit_balance: number; winning_balance: number; bonus_balance: number };

const TITLE: Record<TradingGame, string> = { number: 'Number Trading', card: 'Card Trading', colour: 'Colour Trading' };
const PICK_HINT: Record<TradingGame, string> = {
  number: 'Tap numbers to pick them',
  card: 'Tap cards to pick them',
  colour: 'Tap a colour to pick it'
};

export default function TradingPage({ game, mobile, balance, onBack, onBalances }: {
  game: TradingGame; mobile: string; balance: number; onBack: () => void; onBalances: (b: Balances) => void;
}) {
  const [st, setSt] = useState<State | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState(10);
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [suit, setSuit] = useState<'ALL' | 'S' | 'H' | 'D' | 'C'>('ALL');
  const [reveal, setReveal] = useState<{ receipt: Receipt; won: number } | null>(null);
  const [edge, setEdge] = useState<string | null>(null);

  const lastSeen = useRef<string | null>(null);
  const refreshedFor = useRef<string | null>(null);

  const loadBets = useCallback(async () => {
    if (!mobile) return [] as Bet[];
    try {
      const d = await gamesGet<{ bets: Bet[] }>(`/api/games/trading/${game}/my-bets?mobile=${mobile}`);
      setMyBets(d.bets || []);
      return d.bets || [];
    } catch { return [] as Bet[]; }
  }, [game, mobile]);

  const load = useCallback(async () => {
    try {
      const d = await gamesGet<State>(`/api/games/trading/${game}/state`);
      setSt(d);
      setLoadError('');
      setAmount(a => Math.max(a, d.minBet));
      const newest = d.lastResults[0];
      if (newest) {
        if (lastSeen.current && lastSeen.current !== newest.roundId) {
          // A round just settled while the page was open
          const bets = await loadBets();
          const mine = bets.filter(b => b.roundId === newest.roundId);
          const won = mine.filter(b => b.status === 'won').reduce((s, b) => s + (b.win_amount || 0), 0);
          if (game === 'colour') {
            setEdge(COLOURS[newest.result]?.hex || null);
            setTimeout(() => setEdge(null), 1200);
          }
          if (game !== 'colour' || mine.length > 0) setReveal({ receipt: newest, won });
        }
        lastSeen.current = newest.roundId;
      }
    } catch (e: any) {
      setLoadError(e.message || 'Could not load the game');
    }
  }, [game, loadBets]);

  useEffect(() => {
    load();
    loadBets();
    const id = setInterval(load, game === 'colour' ? 2000 : 5000);
    const id2 = setInterval(loadBets, 15000);
    return () => { clearInterval(id); clearInterval(id2); };
  }, [game, load, loadBets]);

  const now = useServerNow(st?.serverTime);

  // Refresh right as the round ends so the new round and result show without delay
  useEffect(() => {
    if (st && now >= st.round.end && refreshedFor.current !== st.round.roundId) {
      refreshedFor.current = st.round.roundId;
      setTimeout(load, 1200);
    }
  }, [now, st, load]);

  useEffect(() => { if (reveal) { const id = setTimeout(() => setReveal(null), 4500); return () => clearTimeout(id); } }, [reveal]);

  const locked = !!st && now >= st.round.lock;
  const roundBets = useMemo(() => myBets.filter(b => st && b.roundId === st.round.roundId), [myBets, st]);
  const pastBets = useMemo(() => myBets.filter(b => st && b.roundId !== st.round.roundId).slice(0, 20), [myBets, st]);

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
      const d = await gamesPost<{ balances: Balances; bets: Bet[] }>(`/api/games/trading/${game}/bet`, {
        mobile, bets: selected.map(option => ({ option, amount }))
      });
      onBalances(d.balances);
      setMsg({ ok: true, text: `Bet placed on ${selected.length} ${selected.length === 1 ? 'pick' : 'picks'} · ${inr(total)}` });
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
        <p className="text-sm text-gray-400">{loadError || `Loading ${TITLE[game]}…`}</p>
        <button onClick={onBack} className="text-xs font-bold text-[#E0C9A0]">← Back</button>
      </div>
    );
  }

  const receipt = st.lastResults[0];
  const cardSuits = suit === 'ALL' ? ['S', 'H', 'D', 'C'] : [suit];

  return (
    <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#06120C] text-white ${edge ? 'g-edge' : ''}`}
      style={edge ? ({ ['--g-edge' as any]: edge } as CSSProperties) : undefined}>
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-800/80 bg-[#0A0F0D]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 text-gray-300 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h2 className="text-base font-black tracking-wide">{TITLE[game]}</h2>
            <p className="text-[10px] font-semibold text-[#E0C9A0]">Pays {st.payout}x</p>
          </div>
        </div>
        <span className="rounded-full border border-[#C9A87C]/40 bg-[#0C241B] px-3 py-1 text-xs font-extrabold tabular-nums text-[#F0DDB8]">{inr(balance)}</span>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 pb-44 pt-4">
        {!st.enabled && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-300">This game is paused right now.</div>
        )}

        {/* Round card */}
        <GlassCard className="g-rise p-4">
          <div className="flex items-center gap-4">
            <CountdownRing now={now} start={st.round.start} lock={st.round.lock} end={st.round.end} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={locked ? 'locked' : 'open'} />
                <span className="font-mono text-[11px] text-gray-400">{st.round.roundId}</span>
              </div>
              <p className="text-xs font-semibold leading-snug text-gray-200">{st.ruleLine}</p>
              <button onClick={() => setShowRules(true)} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E0C9A0] hover:text-white">
                <Info className="h-3.5 w-3.5" /> How it works
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Last receipt */}
        {receipt && (
          <div className="g-rise flex items-center justify-between rounded-2xl border border-[#C9A87C]/25 bg-[#0C241B] px-4 py-3" style={{ animationDelay: '60ms' }}>
            <div className="text-[11px] text-gray-400">
              <p className="font-mono text-gray-500">{receipt.roundId}</p>
              <p className="mt-0.5">{inr(receipt.winningTotal)} staked on the result{receipt.tiedCount > 1 ? ` · ${receipt.tiedCount} options tied, picked at random` : ' · lowest of all'}</p>
            </div>
            <OptionTag game={game} value={receipt.result} size="lg" />
          </div>
        )}

        {/* Picker */}
        <div className="relative space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-300">{PICK_HINT[game]}</p>
            {selected.length > 0 && <button onClick={() => setSelected([])} className="text-[11px] font-bold text-gray-400 hover:text-white">Clear</button>}
          </div>

          {game === 'number' && (
            <div className="grid grid-cols-10 gap-1.5">
              {st.options.map(o => {
                const on = selected.includes(o);
                return (
                  <button key={o} onClick={() => toggle(o)}
                    className={`aspect-square rounded-lg font-mono text-xs font-extrabold transition-all duration-150 active:scale-90 ${on ? 'bg-[#3EE08A] text-[#0A0F0D] shadow-[0_0_14px_rgba(62,224,138,0.55)]' : 'border border-[#1E5C46] bg-[#0C241B] text-gray-200 hover:border-[#3EE08A]/70 hover:text-white'}`}>
                    {o}
                  </button>
                );
              })}
            </div>
          )}

          {game === 'card' && (
            <div className="space-y-3">
              <div className="g-noscroll flex gap-2 overflow-x-auto">
                {(['ALL', 'S', 'H', 'D', 'C'] as const).map(s => (
                  <button key={s} onClick={() => setSuit(s)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${suit === s ? 'bg-[#F0DDB8] text-[#0A0F0D]' : 'border border-[#1E5C46] bg-[#0C241B] text-gray-300'}`}>
                    {s === 'ALL' ? 'All' : <span className={SUITS[s].red ? (suit === s ? 'text-[#E23B52]' : 'text-[#FF6B7E]') : ''}>{SUITS[s].sym} {SUITS[s].name}</span>}
                  </button>
                ))}
              </div>
              {cardSuits.map(s => (
                <div key={s}>
                  <p className={`mb-1.5 text-[11px] font-bold ${SUITS[s].red ? 'text-[#FF6B7E]' : 'text-gray-300'}`}>{SUITS[s].sym} {SUITS[s].name}</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {st.options.filter(o => cardParts(o).suit === s).map(o => {
                      const on = selected.includes(o);
                      const { rank } = cardParts(o);
                      return (
                        <button key={o} onClick={() => toggle(o)}
                          className={`relative flex aspect-[5/7] flex-col items-center justify-center rounded-lg bg-[#F5EDE2] font-extrabold transition-all duration-150 active:scale-90 ${SUITS[s].red ? 'text-[#E23B52]' : 'text-[#0A0F0D]'} ${on ? '-translate-y-1 ring-2 ring-[#F0DDB8] ring-offset-2 ring-offset-[#06120C] shadow-[0_0_16px_rgba(240,221,184,0.6)]' : 'opacity-90 hover:-translate-y-0.5 hover:opacity-100'}`}>
                          <span className="text-sm leading-none">{rank}</span>
                          <span className="text-base leading-none">{SUITS[s].sym}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {game === 'colour' && (
            <div className="grid grid-cols-3 gap-3">
              {st.options.map(o => {
                const c = COLOURS[o];
                const on = selected.includes(o);
                return (
                  <button key={o} onClick={() => toggle(o)}
                    className={`flex h-28 flex-col items-center justify-center rounded-2xl ${c.bg} text-white shadow-xl transition-all duration-150 active:scale-95 ${on ? 'scale-[1.03] ring-4 ring-white/90 ring-offset-2 ring-offset-[#06120C]' : 'opacity-80 hover:opacity-100'}`}>
                    <span className="text-lg font-black drop-shadow">{c.name}</span>
                    {on && <span className="mt-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-extrabold">Picked</span>}
                  </button>
                );
              })}
            </div>
          )}

          {locked && (
            <div className="absolute inset-0 top-6 flex items-center justify-center rounded-2xl bg-[#06120C]/80 backdrop-blur-[2px]">
              <div className="text-center">
                <p className="text-sm font-extrabold text-white">🔒 Betting closed for this round</p>
                <p className="mt-1 font-mono text-xs text-gray-400">Result in {clock(st.round.end - now)} · next round opens then</p>
              </div>
            </div>
          )}
        </div>

        <AmountPicker value={amount} onChange={setAmount} min={st.minBet} max={st.maxBet} />

        {/* My bets this round */}
        {roundBets.length > 0 && (
          <div className="rounded-2xl border border-[#1E5C46] bg-[#0C241B] p-3">
            <p className="mb-2 text-xs font-bold text-white">Your bets this round</p>
            <div className="flex flex-wrap gap-2">
              {roundBets.map(b => (
                <span key={b.id} className="flex items-center gap-1.5 rounded-full border border-[#1E5C46] bg-[#0A0F0D] px-2 py-1 text-[11px] font-bold text-gray-200">
                  <OptionTag game={game} value={b.option} /> {inr(b.amount)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Last results */}
        {st.lastResults.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-gray-300">Last results</p>
            <div className="g-noscroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {st.lastResults.map(r => (
                <div key={r.roundId} className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-gray-800 bg-[#0C241B] px-2.5 py-2">
                  {game === 'colour'
                    ? <span className={`h-6 w-6 rounded-full ${COLOURS[r.result]?.bg}`} />
                    : <OptionTag game={game} value={r.result} />}
                  <span className="font-mono text-[9px] text-gray-500">{r.roundId.split('-').pop()}</span>
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
                  <OptionTag game={game} value={b.option} />
                  <span className="text-[11px] text-gray-400">{inr(b.amount)} · <span className="font-mono">{b.roundId.split('-').slice(1).join('-')}</span></span>
                </div>
                {b.status === 'won'
                  ? <span className="text-xs font-extrabold text-[#3EE08A]">+{inr(b.win_amount)}</span>
                  : b.status === 'lost'
                    ? <span className="flex items-center gap-1 text-[11px] text-gray-500">Result <OptionTag game={game} value={b.result} /></span>
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
            <span className="text-gray-400">{selected.length === 0 ? 'Nothing picked yet' : `${selected.length} × ${inr(amount)}`}</span>
            <span className="font-bold text-white">Total <span className="tabular-nums text-[#F0DDB8]">{inr(total)}</span></span>
          </div>
          {selected.length > 0 && <p className="text-center text-[10px] text-gray-500">If one of your picks wins: {inr(amount * st.payout)}</p>}
          <button onClick={place} disabled={selected.length === 0 || placing || locked || !st.enabled}
            className="w-full rounded-xl bg-gradient-to-r from-[#F0DDB8] via-[#E0C9A0] to-[#C9A87C] py-3.5 text-sm font-extrabold tracking-wide text-[#0A0F0D] shadow-lg shadow-[#C9A87C]/20 transition-transform active:scale-[0.98] disabled:opacity-40">
            {placing ? 'Placing…' : locked ? 'Betting closed' : 'PLACE BET'}
          </button>
        </div>
      </div>

      {/* Rules */}
      <Sheet open={showRules} onClose={() => setShowRules(false)} title={`How ${TITLE[game]} works`}>
        <ul className="space-y-2.5 text-xs leading-relaxed text-gray-300">
          {st.rules.map((line, i) => (
            <li key={i} className="flex gap-2"><span className="text-[#C9A87C]">•</span><span>{line}</span></li>
          ))}
        </ul>
      </Sheet>

      {/* Result reveal */}
      {reveal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={() => setReveal(null)}>
          <div className="w-72 rounded-3xl border border-[#C9A87C]/40 bg-gradient-to-b from-[#123A2C] to-[#0A0F0D] p-6 text-center shadow-2xl">
            <p className="font-mono text-[11px] text-gray-400">{reveal.receipt.roundId}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#E0C9A0]">Result</p>
            <div className={`mt-4 flex justify-center ${game === 'card' ? 'g-flip' : 'g-pop'}`}>
              {game === 'colour'
                ? <span className={`h-24 w-24 rounded-full ${COLOURS[reveal.receipt.result]?.bg} shadow-2xl`} />
                : game === 'card'
                  ? <span className={`flex h-32 w-24 flex-col items-center justify-center rounded-xl bg-[#F5EDE2] text-3xl font-black shadow-2xl ${SUITS[cardParts(reveal.receipt.result).suit]?.red ? 'text-[#E23B52]' : 'text-[#0A0F0D]'}`}>
                      {cardParts(reveal.receipt.result).rank}<span className="text-4xl">{SUITS[cardParts(reveal.receipt.result).suit]?.sym}</span>
                    </span>
                  : <span className="font-mono text-7xl font-black text-[#F0DDB8]">{reveal.receipt.result}</span>}
            </div>
            <p className="mt-4 text-[11px] text-gray-400">{inr(reveal.receipt.winningTotal)} staked on it{reveal.receipt.tiedCount > 1 ? ` · ${reveal.receipt.tiedCount} tied` : ''}</p>
            {reveal.won > 0
              ? <p className="mt-3 text-lg font-black text-[#3EE08A]">You won {inr(reveal.won)}!</p>
              : <p className="mt-3 text-xs text-gray-500">Tap to close</p>}
          </div>
        </div>
      )}
    </div>
  );
}
