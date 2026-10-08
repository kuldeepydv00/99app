import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { gamesGet, gamesPost } from './api';
import { inr, clock, useServerNow, CountdownRing, SUITS, cardParts, DT_SIDES, OptionTag } from './ui';
import { GameScreen, GameBox, BetAmount, Field, ReadBox, PlayButton, Notice, GameFooter, NvModal, RulesList, BetsTable, PausedNote, MobileBetBar, RoundInfo, rupees } from './kit';
import type { HistoryRow } from './kit';
import type { Balances } from './TradingPage';
import { DT_ART_CSS } from './dtArt';
import { Creature } from './DtCreature';
import type { Mood } from './DtCreature';

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
// Page-level effects: winner flash on the stage; small creatures on the bet tiles only breathe.
const DT_PAGE_CSS = `
.dt-flash{animation:dt-flash 1.6s ease-out forwards}
@keyframes dt-flash{0%{opacity:0}12%{opacity:1}100%{opacity:.35}}
.dtart.dt-tile{animation-duration:4.5s}
.dtart.dt-tile .dt-embers,.dtart.dt-tile .dt-puff{display:none}
@media (prefers-reduced-motion:reduce){.dt-flash{animation:none;opacity:.35}}
`;
const BOARD = ['DRAGON', 'TIE', 'TIGER'] as const;

function PlayingCard({ code, faceDown, glow, animate }: { code?: string | null; faceDown?: boolean; glow?: string | null; animate?: boolean }) {
  const dims = 'h-[5.2rem] w-[3.7rem] sm:h-[6.2rem] sm:w-[4.4rem]';
  if (!code || faceDown) {
    return (
      <div className={`${dims} flex items-center justify-center rounded-xl border-2 border-white/25 shadow-xl`}
        style={{ background: 'repeating-linear-gradient(45deg,#1D4E9E 0 7px,#163D7D 7px 14px)' }}>
        <span className="rounded-full border border-white/40 bg-[#0F1923]/80 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-[#F2C14E]">99x</span>
      </div>
    );
  }
  const { rank, suit } = cardParts(code);
  const s = SUITS[suit];
  const style: CSSProperties | undefined = glow ? { boxShadow: `0 0 0 3px ${glow}, 0 0 34px ${glow}` } : undefined;
  return (
    <div className={`${dims} relative rounded-xl bg-gradient-to-br from-[#FFFDF7] to-[#E9DFD0] font-extrabold shadow-2xl ${s?.red ? 'text-[#D8263F]' : 'text-[#0A0F0D]'} ${animate ? 'g-flip' : ''}`} style={style}>
      <span className="absolute left-1.5 top-1 flex flex-col items-center leading-none"><span className="text-base">{rank}</span><span className="text-xs">{s?.sym}</span></span>
      <span className="absolute inset-0 flex items-center justify-center text-3xl">{s?.sym}</span>
      <span className="absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none"><span className="text-base">{rank}</span><span className="text-xs">{s?.sym}</span></span>
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
      <GameScreen title="Dragon Tiger" balance={balance} onBack={onBack}>
        <p className="py-24 text-center text-[13px] text-nv-mute">{loadError || 'Loading Dragon Tiger…'}</p>
      </GameScreen>
    );
  }

  const showing = reveal?.receipt || null;
  const winner = showing?.result || null;
  const winGlow = winner ? DT_SIDES[winner]?.hex : null;
  const moodOf = (side: 'DRAGON' | 'TIGER'): Mood => (showing ? (winner === side || winner === 'TIE' ? 'win' : 'lose') : locked ? 'tense' : 'idle');
  const dragonMood = moodOf('DRAGON');
  const tigerMood = moodOf('TIGER');
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
    <GameScreen title="Dragon Tiger" kicker={`Dragon / Tiger ${st.payout}x · Tie ${st.tiePayout}x`} balance={balance} onBack={onBack}>
      <style>{DT_ART_CSS + DT_PAGE_CSS}</style>
      <PausedNote show={!st.enabled} />
      <GameBox
        panel={(
          <>
            <RoundInfo locked={locked} roundId={st.round.roundId} ruleLine={st.ruleLine} onRules={() => setShowRules(true)}
              ring={<CountdownRing now={now} start={st.round.start} lock={st.round.lock} end={st.round.end} size={78} />} />
            <BetAmount value={amount} onChange={setAmount} min={st.minBet} max={st.maxBet} balance={balance} label="Amount per pick" />
            <Field label="Your picks" right={selected.length ? <button onClick={() => setSelected([])} className="font-semibold text-nv-blue2 hover:text-white">Clear</button> : undefined}>
              <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md bg-nv-input px-3 py-2 ring-1 ring-nv-edge">
                {selected.length === 0
                  ? <span className="text-[12.5px] text-nv-dim">Tap Dragon, Tie or Tiger</span>
                  : selected.map(o => <button key={o} onClick={() => toggle(o)} title="Remove"><OptionTag game={GAME} value={o} /></button>)}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Total bet"><ReadBox>{rupees(total)}</ReadBox></Field>
              <Field label="If it wins">
                <ReadBox tone="text-nv-green">{selected.length ? rupees(Math.max(...selected.map(o => amount * payOf(o)))) : rupees(0)}</ReadBox>
              </Field>
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
            {/* Dragon vs Tiger */}
            <div className="relative overflow-hidden rounded-lg"
              style={{ background: 'radial-gradient(ellipse 60% 75% at 22% 50%, rgba(234,88,12,.32), transparent 70%), radial-gradient(ellipse 60% 75% at 78% 50%, rgba(61,123,240,.34), transparent 70%), linear-gradient(180deg,#14121A 0%,#0F1923 60%,#0F212E 100%)' }}>
              {showing && winGlow && (
                <div key={showing.roundId + 'flash'} className="dt-flash pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at ${winner === 'DRAGON' ? '25%' : winner === 'TIGER' ? '75%' : '50%'} 45%, ${winGlow}88, transparent 60%)` }} />
              )}
              <div className="relative mx-auto grid max-w-[620px] grid-cols-2 px-1 pt-2">
                <Creature kind="dragon" mood={dragonMood} className="mx-auto aspect-square w-full max-w-[200px] md:max-w-[240px]" />
                <Creature kind="tiger" mood={tigerMood} className="mx-auto aspect-square w-full max-w-[200px] md:max-w-[240px]" />
                <div className="absolute left-1/2 top-[44%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#FFF3B0]/70 text-sm font-black italic text-[#2A1B08] shadow-[0_0_24px_rgba(240,221,184,.55)]"
                  style={{ background: 'radial-gradient(circle at 35% 30%, #FFF6DF, #E0C9A0 40%, #8A6D47 90%)' }}>VS</div>
              </div>
              <div className="relative mx-auto -mt-7 grid max-w-[620px] grid-cols-[1fr_auto_1fr] items-end px-3 pb-2">
                <div className="flex flex-col items-start gap-1 pl-1">
                  <PlayingCard key={showing ? showing.roundId + 'd' : 'down-d'} code={showing?.cards?.dragon} faceDown={!showing} animate={!!showing}
                    glow={showing && winner === 'DRAGON' ? winGlow : showing && winner === 'TIE' ? DT_SIDES.TIE.hex : null} />
                  <span className="text-[11px] font-bold tracking-[0.3em] text-[#FF8A98] drop-shadow">DRAGON</span>
                </div>
                <div className="pb-5 text-center">
                  <p className="font-mono text-[22px] font-bold tabular-nums text-white">{clock((locked ? st.round.end : st.round.lock) - now)}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-nv-mute">{locked ? 'Result in' : 'Closes in'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 pr-1">
                  <PlayingCard key={showing ? showing.roundId + 't' : 'down-t'} code={showing?.cards?.tiger} faceDown={!showing} animate={!!showing}
                    glow={showing && winner === 'TIGER' ? winGlow : showing && winner === 'TIE' ? DT_SIDES.TIE.hex : null} />
                  <span className="text-[11px] font-bold tracking-[0.3em] text-[#8DB7FF] drop-shadow">TIGER</span>
                </div>
              </div>
              <div className="relative min-h-[3.2rem] px-3 pb-3 text-center">
                {showing ? (
                  <div className="g-pop">
                    <p className="bg-clip-text text-2xl font-black tracking-wide text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,.8)]"
                      style={{ backgroundImage: winner === 'TIE' ? 'linear-gradient(180deg,#D1FAE5,#34D399 55%,#047857)' : winner === 'DRAGON' ? 'linear-gradient(180deg,#FFF3B0,#FDBA74 45%,#E23B52)' : 'linear-gradient(180deg,#FFF3B0,#93C5FD 45%,#3D7BF0)' }}>
                      {winner === 'TIE' ? 'IT’S A TIE!' : `${DT_SIDES[winner || '']?.name.toUpperCase()} WINS!`}
                    </p>
                    {reveal && reveal.won > 0
                      ? <p className="text-base font-bold text-nv-green">You won {rupees(reveal.won)}!</p>
                      : reveal && reveal.staked > 0 ? <p className="text-[11px] text-nv-mute">Not this time</p> : null}
                  </div>
                ) : locked ? (
                  <p className="animate-pulse pt-3 text-[13px] font-semibold text-nv-text">Dealing the cards…</p>
                ) : (
                  <p className="pt-3 text-[13px] font-semibold text-white">Place your bets</p>
                )}
              </div>
            </div>

            {/* Betting board */}
            <div className="relative">
              <div className="grid grid-cols-[1fr_0.8fr_1fr] gap-2">
                {BOARD.map(o => {
                  const d = DT_SIDES[o];
                  const on = selected.includes(o);
                  return (
                    <button key={o} onClick={() => toggle(o)}
                      className={`nv-tap relative flex h-36 flex-col items-center justify-start overflow-hidden rounded-lg border border-white/10 ${d.bg} pt-2 text-white shadow-xl transition-all duration-150 active:scale-95 ${on ? 'scale-[1.02] ring-[3px] ring-white' : 'opacity-90 hover:opacity-100'}`}>
                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.22),transparent_60%)]" />
                      {o === 'TIE'
                        ? <span className="relative mt-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#FFF3B0]/80 text-lg font-black text-[#2A1B08] shadow-[0_0_18px_rgba(255,243,176,.5)]"
                            style={{ background: 'radial-gradient(circle at 35% 30%, #FFF6DF, #E0C9A0 45%, #8A6D47 95%)' }}>=</span>
                        : <Creature kind={o === 'DRAGON' ? 'dragon' : 'tiger'} mood={on ? 'tense' : 'idle'} className="dt-tile relative h-[4.2rem] w-[4.2rem]" />}
                      <span className={`relative mt-1 font-bold tracking-wide drop-shadow ${o === 'TIE' ? 'mt-2 text-[15px]' : 'text-[17px]'}`}>{d.name.toUpperCase()}</span>
                      <span className="relative mt-0.5 rounded bg-black/35 px-2 py-0.5 text-[11px] font-bold">{payOf(o)}x</span>
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
                    <p className="mt-1 text-[12px] tabular-nums text-nv-mute">Result in {clock(st.round.end - now)} · the next round opens then</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bead road */}
            {beads.length > 0 && (
              <div className="rounded-lg bg-nv-panel p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-white">Last {Math.min(60, st.lastResults.length)} results</p>
                  <div className="flex items-center gap-2 text-[10.5px] font-semibold">
                    <span className="flex items-center gap-1 text-[#FF8A98]"><Bead result="DRAGON" small /> {counts.DRAGON}</span>
                    <span className="flex items-center gap-1 text-[#8DB7FF]"><Bead result="TIGER" small /> {counts.TIGER}</span>
                    <span className="flex items-center gap-1 text-nv-green"><Bead result="TIE" small /> {counts.TIE}</span>
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
        footer={<GameFooter name="Dragon Tiger" onRules={() => setShowRules(true)} />}
      />

      <BetsTable rows={rows} />

      <MobileBetBar show={selected.length > 0 && !locked}
        label={<><b className="text-white">{selected.map(o => DT_SIDES[o]?.name).join(' + ')}</b><br />Total {rupees(total, 0)}</>}
        button="Place Bet" onClick={place} busy={placing} disabled={!st.enabled} />

      <NvModal open={showRules} onClose={() => setShowRules(false)} title="How Dragon Tiger works">
        <RulesList lines={st.rules} />
      </NvModal>
    </GameScreen>
  );
}
