import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Percent, X as Times } from 'lucide-react';
import { gamesGet, gamesPost } from './api';
import type { Balances } from './TradingPage';
import { GameScreen, GameBox, BetAmount, Field, ReadBox, PlayButton, Notice, GameFooter, NvModal, RulesList, BetsTable, PausedNote, rupees } from './kit';
import type { HistoryRow } from './kit';
import FairnessModal from './Fairness';

type Config = { enabled: boolean; edgePct: number; minBet: number; maxBet: number; maxProfit: number; minChance: number; maxChance: number };
type DiceBet = { id: string; game: string; mode: 'over' | 'under'; target: number; chance: number; multiplier: number; amount: number; status: string; win_amount: number; result: string; created_at: string };
type Mode = 'over' | 'under';

const floor4 = (n: number) => Math.floor(n * 10000 + 1e-9) / 10000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function DicePage({ mobile, balance, onBack, onBalances }: {
  mobile: string; balance: number; onBack: () => void; onBalances: (b: Balances) => void;
}) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState(10);
  const [mode, setMode] = useState<Mode>('over');
  const [target, setTarget] = useState(50.5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [last, setLast] = useState<{ roll: number; won: boolean; key: number } | null>(null);
  const [recent, setRecent] = useState<{ roll: number; won: boolean; key: number }[]>([]);
  const [bets, setBets] = useState<DiceBet[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showFair, setShowFair] = useState(false);
  const [multText, setMultText] = useState<string | null>(null);
  const [chanceText, setChanceText] = useState<string | null>(null);
  const [targetText, setTargetText] = useState<string | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    gamesGet<{ config: Config; rules: string[] }>('/api/games/instant/dice/state')
      .then(d => { setCfg(d.config); setRules(d.rules); setAmount(a => Math.max(a, d.config.minBet)); })
      .catch(e => setLoadError(e.message || 'Could not load Dice'));
  }, []);

  const loadBets = useCallback(() => {
    if (!mobile) return;
    gamesGet<{ bets: DiceBet[] }>(`/api/games/instant/my-bets?mobile=${mobile}&game=dice&limit=20`).then(d => setBets(d.bets || [])).catch(() => {});
  }, [mobile]);
  useEffect(() => { loadBets(); }, [loadBets]);

  const edge = (cfg?.edgePct ?? 10) / 100;
  const minC = cfg?.minChance ?? 0.01, maxC = cfg?.maxChance ?? 89.09;
  const chance = r2(mode === 'over' ? 100 - target : target);
  const multiplier = floor4((100 * (1 - edge)) / chance);
  const profit = Math.max(0, amount * multiplier - amount);
  const tooBig = !!cfg && profit > cfg.maxProfit;

  // keep the target inside the allowed win chance
  const setChance = (c: number) => {
    const cc = r2(Math.min(maxC, Math.max(minC, c)));
    setTarget(mode === 'over' ? r2(100 - cc) : cc);
  };
  const setFromTarget = (t: number) => setChance(mode === 'over' ? 100 - t : t);
  const flip = () => { setMode(m => (m === 'over' ? 'under' : 'over')); setTarget(t => r2(100 - t)); };
  useEffect(() => { if (cfg) setChance(chance); /* re-clamp when limits arrive */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  const bet = async () => {
    if (!cfg || busy) return;
    if (!mobile) { setMsg({ ok: false, text: 'Please log in to play.' }); return; }
    if (amount > balance + 0.001) { setMsg({ ok: false, text: `Not enough balance for ${rupees(amount, 0)}.` }); return; }
    if (tooBig) { setMsg({ ok: false, text: `Max profit per bet is ${rupees(cfg.maxProfit, 0)}. Lower the bet or the multiplier.` }); return; }
    setBusy(true); setMsg(null);
    try {
      const d = await gamesPost<{ roll: number; won: boolean; payout: number; balances: Balances; bet: DiceBet }>('/api/games/dice/bet', { mobile, amount, target, mode });
      const k = ++keyRef.current;
      setLast({ roll: d.roll, won: d.won, key: k });
      setRecent(r => [{ roll: d.roll, won: d.won, key: k }, ...r].slice(0, 8));
      setBets(b => [d.bet, ...b].slice(0, 20));
      onBalances(d.balances);
      if (d.won) setMsg({ ok: true, text: `Rolled ${d.roll.toFixed(2)} · won ${rupees(d.payout)}` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Could not place bet' });
    }
    setBusy(false);
  };

  const rows: HistoryRow[] = useMemo(() => bets.map(b => ({
    id: b.id, amount: b.amount, multiplier: b.multiplier, payout: b.win_amount, status: b.status,
    what: <span className="tabular-nums"><b className={b.status === 'won' ? 'text-nv-green' : 'text-white'}>{b.result}</b> <span className="text-nv-mute">· {b.mode === 'over' ? 'over' : 'under'} {Number(b.target).toFixed(2)}</span></span>
  })), [bets]);

  if (!cfg) {
    return (
      <GameScreen title="Dice" balance={balance} onBack={onBack}>
        <p className="py-24 text-center text-[13px] text-nv-mute">{loadError || 'Loading Dice…'}</p>
      </GameScreen>
    );
  }

  // slider: red part loses, green part wins
  const winFrom = mode === 'over' ? target : 0, winTo = mode === 'over' ? 100 : target;
  const inputBox = 'flex h-10 items-center gap-1 rounded-md bg-nv-input px-2 ring-1 ring-nv-edge focus-within:ring-nv-blue2 sm:h-11 sm:gap-2 sm:px-3';
  const numInput = 'h-full w-full min-w-0 flex-1 bg-transparent text-[13px] font-semibold tabular-nums text-white focus:outline-none sm:text-[14px]';

  return (
    <GameScreen title="Dice" balance={balance} onBack={onBack}>
      <PausedNote show={!cfg.enabled} />
      <GameBox
        panel={(
          <>
            <BetAmount value={amount} onChange={setAmount} min={cfg.minBet} max={cfg.maxBet} balance={balance} disabled={busy} />
            <Field label="Profit on Win" right={`${multiplier.toFixed(4)}×`}>
              <ReadBox tone={tooBig ? 'text-nv-red' : 'text-white'}>{rupees(profit)}</ReadBox>
            </Field>
            {tooBig && <p className="-mt-1 text-[11px] font-semibold text-nv-red">Max profit per bet is {rupees(cfg.maxProfit, 0)}.</p>}
            <PlayButton onClick={bet} busy={busy} disabled={!cfg.enabled || tooBig}>Bet</PlayButton>
            <Notice msg={msg} />
          </>
        )}
        stage={(
          <div className="flex h-full flex-col justify-between gap-5 p-3 sm:gap-6 sm:p-8 lg:min-h-[520px]">
            {/* recent rolls */}
            <div className="flex min-h-[32px] justify-end gap-1.5 overflow-hidden">
              {recent.map(r => (
                <span key={r.key} className={`g-pop rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums ${r.won ? 'bg-nv-green text-[#05210F]' : 'bg-nv-edge text-white'}`}>{r.roll.toFixed(2)}</span>
              ))}
            </div>

            {/* slider */}
            <div className="px-2 pt-10 sm:px-6">
              <div className="relative rounded-full bg-nv-edge p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] sm:p-4">
                <div className="relative h-2.5 rounded-full">
                  <div className="absolute inset-y-0 rounded-full bg-nv-red" style={{ left: 0, right: 0 }} />
                  <div className="absolute inset-y-0 rounded-full bg-nv-green transition-all duration-150" style={{ left: `${winFrom}%`, right: `${100 - winTo}%` }} />
                  {/* result marker */}
                  {last && (
                    <div key={last.key} className="absolute -top-14 -translate-x-1/2 transition-[left] duration-300 ease-out" style={{ left: `${last.roll}%` }}>
                      <div className={`g-pop flex h-10 min-w-[56px] items-center justify-center rounded-md px-2 text-[14px] font-bold tabular-nums shadow-lg ${last.won ? 'bg-nv-green text-[#05210F]' : 'bg-nv-red text-white'}`}>
                        {last.roll.toFixed(2)}
                      </div>
                      <div className={`mx-auto h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent ${last.won ? 'border-t-nv-green' : 'border-t-nv-red'}`} />
                    </div>
                  )}
                  {/* handle */}
                  <div className="pointer-events-none absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-nv-blue2 shadow-[0_2px_8px_rgba(0,0,0,0.4)]" style={{ left: `${target}%` }}>
                    <span className="flex gap-[3px]">{[0, 1, 2].map(i => <span key={i} className="h-3.5 w-[2px] rounded bg-white/70" />)}</span>
                  </div>
                  <input type="range" min={0} max={100} step={0.01} value={target} disabled={busy} aria-label="Target"
                    onChange={e => setFromTarget(parseFloat(e.target.value))}
                    className="absolute -inset-y-4 inset-x-0 w-full cursor-pointer opacity-0" />
                </div>
              </div>
              <div className="relative mx-3 mt-3 h-6 text-[12px] font-semibold text-nv-text sm:mx-4 sm:text-[13px]">
                {[0, 25, 50, 75, 100].map(n => (
                  <span key={n} className="absolute -translate-x-1/2" style={{ left: `${n}%` }}>{n}</span>
                ))}
              </div>
            </div>

            {/* multiplier / roll over / win chance */}
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-nv-panel p-2.5 sm:gap-3 sm:p-4">
              <Field label="Multiplier">
                <label className={inputBox}>
                  <input value={multText ?? multiplier.toFixed(4)} inputMode="decimal" className={numInput}
                    onFocus={e => { setMultText(multiplier.toFixed(4)); e.currentTarget.select(); }}
                    onChange={e => setMultText(e.target.value.replace(/[^0-9.]/g, ''))}
                    onBlur={() => { const m = parseFloat(multText || ''); if (m > 0) setChance((100 * (1 - edge)) / m); setMultText(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                  <Times className="hidden h-4 w-4 shrink-0 text-nv-mute sm:block" />
                </label>
              </Field>
              <Field label={mode === 'over' ? 'Roll Over' : 'Roll Under'}>
                <label className={inputBox}>
                  <input value={targetText ?? target.toFixed(2)} inputMode="decimal" className={numInput}
                    onFocus={e => { setTargetText(target.toFixed(2)); e.currentTarget.select(); }}
                    onChange={e => setTargetText(e.target.value.replace(/[^0-9.]/g, ''))}
                    onBlur={() => { const t = parseFloat(targetText || ''); if (Number.isFinite(t)) setFromTarget(t); setTargetText(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                  <button onClick={flip} disabled={busy} aria-label="Switch roll over and roll under" title="Switch over / under"
                    className="nv-tap shrink-0 rounded p-1 text-nv-mute transition-colors hover:bg-nv-edge hover:text-white">
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                </label>
              </Field>
              <Field label="Win Chance">
                <label className={inputBox}>
                  <input value={chanceText ?? chance.toFixed(2)} inputMode="decimal" className={numInput}
                    onFocus={e => { setChanceText(chance.toFixed(2)); e.currentTarget.select(); }}
                    onChange={e => setChanceText(e.target.value.replace(/[^0-9.]/g, ''))}
                    onBlur={() => { const c = parseFloat(chanceText || ''); if (Number.isFinite(c)) setChance(c); setChanceText(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                  <Percent className="hidden h-4 w-4 shrink-0 text-nv-mute sm:block" />
                </label>
              </Field>
            </div>
          </div>
        )}
        footer={<GameFooter name="Dice" onRules={() => setShowRules(true)} onFairness={() => setShowFair(true)} />}
      />

      <BetsTable rows={rows} />

      <NvModal open={showRules} onClose={() => setShowRules(false)} title="How Dice works">
        <RulesList lines={rules} />
      </NvModal>
      <FairnessModal open={showFair} onClose={() => setShowFair(false)} mobile={mobile} game="dice" />
    </GameScreen>
  );
}
