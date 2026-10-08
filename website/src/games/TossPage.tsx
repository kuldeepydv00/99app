import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gamesGet, gamesPost } from './api';
import { inr, clock, useServerNow, CountdownRing, TOSS_SIDES, OptionTag } from './ui';
import { GameScreen, GameBox, BetAmount, Field, ReadBox, PlayButton, Notice, GameFooter, NvModal, RulesList, BetsTable, PausedNote, MobileBetBar, RoundInfo, rupees } from './kit';
import type { HistoryRow } from './kit';
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
      <GameScreen title="Toss" balance={balance} onBack={onBack}>
        <p className="py-24 text-center text-[13px] text-nv-mute">{loadError || 'Loading Toss…'}</p>
      </GameScreen>
    );
  }

  const phase: CoinPhase = coin.phase || (locked ? 'tense' : 'idle');
  const landed = coin.phase === 'landed' && coin.receipt;
  const winner = landed ? coin.receipt!.result : null;
  const winHex = winner ? TOSS_SIDES[winner]?.hex : undefined;
  const rows: HistoryRow[] = pastBets.map(b => ({
    id: b.id, amount: b.amount, multiplier: b.status === 'won' ? b.multiplier : null, payout: b.win_amount, status: b.status,
    what: (
      <span className="flex items-center gap-2">
        <OptionTag game={GAME} value={b.option} />
        <span className="font-mono text-[11px] text-nv-mute">{b.roundId.split('-').slice(1).join('-')}</span>
        {b.status === 'lost' && b.result && <span className="flex items-center gap-1 text-[11px] text-nv-mute">· result <OptionTag game={GAME} value={b.result} /></span>}
      </span>
    )
  }));

  return (
    <GameScreen title="Toss" kicker={`Head / Tail pay ${st.payout}x`} balance={balance} onBack={onBack}>
      <TossStyle />
      <PausedNote show={!st.enabled} />
      <GameBox
        panel={(
          <>
            <RoundInfo locked={locked} roundId={st.round.roundId} ruleLine={st.ruleLine} onRules={() => setShowRules(true)}
              ring={<CountdownRing now={now} start={st.round.start} lock={st.round.lock} end={st.round.end} size={78} />} />
            <BetAmount value={amount} onChange={setAmount} min={st.minBet} max={st.maxBet} balance={balance} label="Amount per pick" />
            <Field label="Your pick" right={selected.length ? <button onClick={() => setSelected([])} className="font-semibold text-nv-blue2 hover:text-white">Clear</button> : undefined}>
              <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md bg-nv-input px-3 py-2 ring-1 ring-nv-edge">
                {selected.length === 0
                  ? <span className="text-[12.5px] text-nv-dim">Tap Head or Tail</span>
                  : selected.map(o => <button key={o} onClick={() => toggle(o)} title="Remove"><OptionTag game={GAME} value={o} /></button>)}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Total bet"><ReadBox>{rupees(total)}</ReadBox></Field>
              <Field label="If it wins"><ReadBox tone="text-nv-green">{rupees(selected.length ? amount * st.payout : 0)}</ReadBox></Field>
            </div>
            <PlayButton onClick={place} busy={placing} disabled={selected.length === 0 || locked || !st.enabled}>
              {locked ? 'Betting closed' : selected.length ? `Place Bet · ${rupees(total, 0)}` : 'Place Bet'}
            </PlayButton>
            <Notice msg={msg} />
            {roundBets.length > 0 && (
              <Field label="Your bets this round">
                <div className="flex flex-wrap gap-1.5">
                  {roundBets.map(b => (
                    <span key={b.id} className="flex items-center gap-1.5 rounded-md bg-nv-input px-2 py-1 text-[11.5px] font-semibold text-nv-text ring-1 ring-nv-edge">
                      <OptionTag game={GAME} value={b.option} /> {rupees(b.amount, 0)}
                    </span>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}
        stage={(
          <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
            {/* the coin */}
            <div className="relative overflow-hidden rounded-lg"
              style={{ background: 'radial-gradient(ellipse 45% 55% at 50% 48%, rgba(255,214,102,.20), transparent 70%), radial-gradient(ellipse 50% 80% at 8% 60%, rgba(226,59,82,.24), transparent 70%), radial-gradient(ellipse 50% 80% at 92% 60%, rgba(61,123,240,.26), transparent 70%), linear-gradient(180deg,#14121A 0%,#0F1923 60%,#0F212E 100%)' }}>
              {landed && winHex && (
                <div key={coin.key + 'flash'} className="tc-flash pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, ${winHex}77, transparent 62%)` }} />
              )}
              <div className="relative mx-auto flex max-w-[560px] items-end justify-between px-4 pt-4">
                <div className="mb-10 flex w-16 flex-col items-center gap-1 opacity-90">
                  <CoinFace side="HEAD" className="h-12 w-12" />
                  <span className="text-[10px] font-bold tracking-[0.25em] text-[#FF8A98]">HEAD</span>
                </div>
                <TossCoin key={coin.key || 'coin'} phase={phase} from={coin.from} end={coin.end} size="clamp(128px, 32vw, 176px)" glow={winHex} className="-mt-2" />
                <div className="mb-10 flex w-16 flex-col items-center gap-1 opacity-90">
                  <CoinFace side="TAIL" className="h-12 w-12" />
                  <span className="text-[10px] font-bold tracking-[0.25em] text-[#8DB7FF]">TAIL</span>
                </div>
              </div>
              <div className="relative min-h-[4rem] px-4 pb-4 pt-1 text-center">
                {landed ? (
                  <div className="g-pop">
                    <p className="bg-clip-text text-2xl font-black tracking-wide text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,.8)]"
                      style={{ backgroundImage: winner === 'HEAD' ? 'linear-gradient(180deg,#FFF3B0,#FDBA74 45%,#E23B52)' : 'linear-gradient(180deg,#FFF3B0,#93C5FD 45%,#3D7BF0)' }}>
                      {TOSS_SIDES[winner || '']?.name.toUpperCase()} WINS!
                    </p>
                    {coin.won > 0
                      ? <p className="text-base font-bold text-nv-green">You won {rupees(coin.won)}!</p>
                      : coin.staked > 0 ? <p className="text-[11px] text-nv-mute">Not this time</p> : null}
                  </div>
                ) : coin.phase === 'flip' ? (
                  <p className="animate-pulse pt-2 text-lg font-bold tracking-wide text-[#FFE48A]">Tossing…</p>
                ) : (
                  <>
                    <p className="font-mono text-[22px] font-bold tabular-nums text-white">{clock((locked ? st.round.end : st.round.lock) - now)}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-nv-mute">{locked ? 'Coin in hand · toss in' : 'Place your bets · closes in'}</p>
                  </>
                )}
              </div>
            </div>

            {/* Head / Tail buttons */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-2.5">
                {SIDES.map(o => {
                  const d = TOSS_SIDES[o];
                  const on = selected.includes(o);
                  return (
                    <button key={o} onClick={() => toggle(o)}
                      className={`nv-tap relative flex h-36 flex-col items-center justify-center overflow-hidden rounded-lg border border-white/10 ${d.bg} text-white shadow-xl transition-all duration-150 active:scale-95 ${on ? 'scale-[1.02] ring-[3px] ring-white' : 'opacity-90 hover:opacity-100'}`}>
                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.22),transparent_60%)]" />
                      <CoinFace side={o} className="relative h-16 w-16" />
                      <span className="relative mt-2 text-[19px] font-bold tracking-wide drop-shadow">{d.name.toUpperCase()}</span>
                      <span className="relative mt-0.5 rounded bg-black/35 px-2 py-0.5 text-[11px] font-bold">{st.payout}x</span>
                      {myStake[o] ? <span className="absolute left-1/2 top-1.5 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-0.5 text-[10px] font-bold text-nv-bg shadow">You: {rupees(myStake[o], 0)}</span> : null}
                      {on && <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-nv-bg shadow">✓</span>}
                    </button>
                  );
                })}
              </div>
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-nv-input/85 backdrop-blur-[2px]">
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-white">Betting closed for this round</p>
                    <p className="mt-1 text-[12px] tabular-nums text-nv-mute">Toss in {clock(st.round.end - now)} · the next round opens then</p>
                  </div>
                </div>
              )}
            </div>

            {/* History */}
            {beads.length > 0 && (
              <div className="rounded-lg bg-nv-panel p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-white">Last {Math.min(60, st.lastResults.length)} tosses</p>
                  <div className="flex items-center gap-2 text-[10.5px] font-semibold">
                    <span className="flex items-center gap-1 text-[#FF8A98]"><Bead result="HEAD" small /> {counts.HEAD}</span>
                    <span className="flex items-center gap-1 text-[#8DB7FF]"><Bead result="TAIL" small /> {counts.TAIL}</span>
                  </div>
                </div>
                <div className="nv-noscroll flex gap-1 overflow-x-auto">
                  {beads.map((col, i) => (
                    <div key={i} className="flex shrink-0 flex-col gap-1">
                      {col.map(r => <Bead key={r.roundId} result={r.result} />)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        footer={<GameFooter name="Toss" onRules={() => setShowRules(true)} />}
      />

      <BetsTable rows={rows} />

      <MobileBetBar show={selected.length > 0 && !locked}
        label={<><b className="text-white">{selected.map(o => TOSS_SIDES[o]?.name).join(' + ')}</b><br />Total {rupees(total, 0)}</>}
        button="Place Bet" onClick={place} busy={placing} disabled={!st.enabled} />

      <NvModal open={showRules} onClose={() => setShowRules(false)} title="How Toss works">
        <RulesList lines={st.rules} />
      </NvModal>
    </GameScreen>
  );
}
