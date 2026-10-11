import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { gamesGet, gamesPost, everyVisible } from './api';
import type { TradingGame } from './api';
import { inr, clock, useServerNow, OptionTag, CountdownRing, SUITS, cardParts, COLOURS } from './ui';
import { GameScreen, GameBox, BetAmount, Field, ReadBox, PlayButton, Notice, GameFooter, NvModal, RulesList, BetsTable, PausedNote, MobileBetBar, RoundInfo, ResultPop, rupees } from './kit';
import type { HistoryRow } from './kit';

type Round = { roundId: string; start: number; lock: number; end: number; status: string };
type Receipt = { roundId: string; result: string; winningTotal: number; tiedCount: number; totalOptions: number; end: number };
type State = {
  game: TradingGame; label: string; serverTime: number; enabled: boolean; payout: number; minBet: number; maxBet: number;
  options: string[]; round: Round; lastResults: Receipt[]; ruleLine: string; rules: string[];
};
type Bet = { id: string; roundId: string; option: string; amount: number; multiplier: number; status: string; win_amount: number; result: string | null; created_at: string };
export type Balances = { balance: number; deposit_balance: number; winning_balance: number; bonus_balance: number };

const TITLE: Record<TradingGame, string> = { number: 'Number Trading', card: 'Card Trading', colour: 'Colour Trading', dragontiger: 'Dragon Tiger', toss: 'Toss' };
const PICK_HINT: Record<TradingGame, string> = {
  number: 'Tap numbers to pick them',
  card: 'Tap cards to pick them',
  colour: 'Tap a colour to pick it',
  dragontiger: 'Tap Dragon, Tie or Tiger', // Dragon Tiger has its own page (DragonTigerPage)
  toss: 'Tap Head or Tail' // Toss has its own page (TossPage)
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
    const stop = everyVisible(load, game === 'colour' ? 2000 : 5000);
    const stop2 = everyVisible(loadBets, 15000);
    return () => { stop(); stop2(); };
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
      <GameScreen title={TITLE[game]} balance={balance} onBack={onBack}>
        <p className="py-24 text-center text-[13px] text-nv-mute">{loadError || `Loading ${TITLE[game]}…`}</p>
      </GameScreen>
    );
  }

  const cardSuits = suit === 'ALL' ? ['S', 'H', 'D', 'C'] : [suit];
  const rows: HistoryRow[] = pastBets.map(b => ({
    id: b.id, amount: b.amount, multiplier: b.status === 'won' ? b.multiplier : null, payout: b.win_amount, status: b.status,
    what: (
      <span className="flex items-center gap-2">
        <OptionTag game={game} value={b.option} />
        <span className="font-mono text-[11px] text-nv-mute">{b.roundId.split('-').slice(1).join('-')}</span>
        {b.status === 'lost' && b.result && <span className="flex items-center gap-1 text-[11px] text-nv-mute">· result <OptionTag game={game} value={b.result} /></span>}
      </span>
    )
  }));
  const pickLabel = selected.length === 0 ? PICK_HINT[game] : `${selected.length} pick${selected.length === 1 ? '' : 's'} × ${rupees(amount, 0)}`;

  return (
    <GameScreen title={TITLE[game]} kicker={`Pays ${st.payout}x · 99x Originals`} balance={balance} onBack={onBack} live={{ key: game }}>
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
                  ? <span className="text-[12.5px] text-nv-dim">{PICK_HINT[game]}</span>
                  : selected.map(o => <button key={o} onClick={() => toggle(o)} title="Remove"><OptionTag game={game} value={o} /></button>)}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Total bet"><ReadBox>{rupees(total)}</ReadBox></Field>
              <Field label="Win per pick"><ReadBox tone="text-nv-green">{rupees(amount * st.payout)}</ReadBox></Field>
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
                      <OptionTag game={game} value={b.option} /> {rupees(b.amount, 0)}
                    </span>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}
        stageClass={edge ? 'g-edge' : ''}
        stage={(
          <div className="flex h-full flex-col gap-4 p-3 sm:p-5" style={edge ? ({ ['--g-edge' as any]: edge } as CSSProperties) : undefined}>
            {/* last results */}
            {st.lastResults.length > 0 && (
              <div className="nv-noscroll -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
                <span className="shrink-0 text-[11.5px] font-semibold text-nv-mute">Last</span>
                {st.lastResults.map(r => (
                  <span key={r.roundId} className="shrink-0">
                    {game === 'colour' ? <span className={`block h-6 w-6 rounded-full ${COLOURS[r.result]?.bg}`} /> : <OptionTag game={game} value={r.result} />}
                  </span>
                ))}
              </div>
            )}

            <div className="relative flex-1">
              {game === 'number' && (
                <div className="mx-auto grid max-w-[540px] grid-cols-10 gap-1 sm:gap-1.5">
                  {st.options.map(o => {
                    const on = selected.includes(o);
                    return (
                      <button key={o} onClick={() => toggle(o)}
                        className={`nv-tap aspect-square rounded-md text-[12px] font-bold tabular-nums transition-all duration-150 active:scale-90 sm:text-[13px] ${on ? 'bg-nv-green text-[#05210F] shadow-[0_0_14px_rgba(31,214,95,0.5)]' : 'bg-nv-edge text-white shadow-[0_3px_0_#1B2C38] hover:-translate-y-0.5 hover:bg-[#557086]'}`}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}

              {game === 'card' && (
                <div className="space-y-3">
                  <div className="nv-noscroll flex gap-1.5 overflow-x-auto">
                    {(['ALL', 'S', 'H', 'D', 'C'] as const).map(s => (
                      <button key={s} onClick={() => setSuit(s)}
                        className={`nv-tap shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${suit === s ? 'bg-nv-card2 text-white ring-1 ring-white/20' : 'bg-nv-panel text-nv-text hover:text-white'}`}>
                        {s === 'ALL' ? 'All' : <span className={SUITS[s].red ? 'text-[#FF6B7E]' : ''}>{SUITS[s].sym} {SUITS[s].name}</span>}
                      </button>
                    ))}
                  </div>
                  {cardSuits.map(s => (
                    <div key={s}>
                      <p className={`mb-1.5 text-[11.5px] font-semibold ${SUITS[s].red ? 'text-[#FF6B7E]' : 'text-nv-text'}`}>{SUITS[s].sym} {SUITS[s].name}</p>
                      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13 lg:grid-cols-7 xl:grid-cols-13">
                        {st.options.filter(o => cardParts(o).suit === s).map(o => {
                          const on = selected.includes(o);
                          const { rank } = cardParts(o);
                          return (
                            <button key={o} onClick={() => toggle(o)}
                              className={`nv-tap relative flex aspect-[5/7] flex-col items-center justify-center rounded-md bg-[#F5F7FA] font-bold transition-all duration-150 active:scale-90 ${SUITS[s].red ? 'text-[#E23B52]' : 'text-[#0F1923]'} ${on ? '-translate-y-1 ring-2 ring-nv-green ring-offset-2 ring-offset-nv-input shadow-[0_0_16px_rgba(31,214,95,0.5)]' : 'opacity-90 hover:-translate-y-0.5 hover:opacity-100'}`}>
                              <span className="text-[13px] leading-none">{rank}</span>
                              <span className="text-[15px] leading-none">{SUITS[s].sym}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {game === 'colour' && (
                <div className="grid h-full min-h-[220px] grid-cols-3 gap-3">
                  {st.options.map(o => {
                    const c = COLOURS[o];
                    const on = selected.includes(o);
                    return (
                      <button key={o} onClick={() => toggle(o)}
                        className={`nv-tap flex min-h-[140px] flex-col items-center justify-center rounded-lg ${c.bg} text-white shadow-xl transition-all duration-150 active:scale-95 ${on ? 'scale-[1.02] ring-4 ring-white/90 ring-offset-2 ring-offset-nv-input' : 'opacity-85 hover:opacity-100'}`}>
                        <span className="text-[18px] font-bold drop-shadow">{c.name}</span>
                        <span className="mt-1 rounded bg-black/25 px-2 py-0.5 text-[11px] font-semibold">{on ? 'Picked' : `${st.payout}x`}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {locked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-nv-input/85 backdrop-blur-[2px]">
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-white">Betting closed for this round</p>
                    <p className="mt-1 text-[12px] tabular-nums text-nv-mute">Result in {clock(st.round.end - now)} · the next round opens then</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        footer={<GameFooter name={TITLE[game]} onRules={() => setShowRules(true)} />}
      />

      <BetsTable rows={rows} />

      <MobileBetBar show={selected.length > 0 && !locked} label={<><b className="text-white">{pickLabel}</b><br />Total {rupees(total, 0)}</>}
        button="Place Bet" onClick={place} busy={placing} disabled={!st.enabled} />

      <NvModal open={showRules} onClose={() => setShowRules(false)} title={`How ${TITLE[game]} works`}>
        <RulesList lines={st.rules} />
      </NvModal>

      <ResultPop show={!!reveal} onClose={() => setReveal(null)} title={`Result · ${reveal?.receipt.roundId || ''}`} won={reveal?.won || 0}>
        {reveal && (
          <div className={game === 'card' ? 'g-flip' : 'g-pop'}>
            {game === 'colour'
              ? <span className={`block h-24 w-24 rounded-full ${COLOURS[reveal.receipt.result]?.bg} shadow-2xl`} />
              : game === 'card'
                ? <span className={`flex h-32 w-24 flex-col items-center justify-center rounded-lg bg-[#F5F7FA] text-3xl font-bold shadow-2xl ${SUITS[cardParts(reveal.receipt.result).suit]?.red ? 'text-[#E23B52]' : 'text-[#0F1923]'}`}>
                    {cardParts(reveal.receipt.result).rank}<span className="text-4xl">{SUITS[cardParts(reveal.receipt.result).suit]?.sym}</span>
                  </span>
                : <span className="font-mono text-7xl font-bold text-white">{reveal.receipt.result}</span>}
          </div>
        )}
      </ResultPop>
    </GameScreen>
  );
}
