import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Shuffle } from 'lucide-react';
import { gamesGet, gamesPost } from './api';
import type { Balances } from './TradingPage';
import { GameScreen, GameBox, BetAmount, Field, ReadBox, PlayButton, Notice, GameFooter, NvModal, RulesList, BetsTable, PausedNote, rupees } from './kit';
import type { HistoryRow } from './kit';
import FairnessModal from './Fairness';

type Config = { enabled: boolean; edgePct: number; minBet: number; maxBet: number; maxProfit: number; tiles: number };
type Game = {
  id: string; amount: number; mines: number; picks: number[]; status: 'playing' | 'cashed' | 'busted';
  multiplier: number; next: number | null; cashout: number; hit: number | null; minesAt: number[] | null;
};
type MinesBet = { id: string; game: string; mines: number; picks?: number[]; amount: number; multiplier: number | null; status: string; win_amount: number; result: string | null };

/** Green gem. */
export function GemIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <polygon points="10,23 21,10 43,10 54,23 32,56" fill="#00B84E" />
      <polygon points="10,23 21,10 25,23" fill="#5CF58D" />
      <polygon points="21,10 43,10 39,23 25,23" fill="#9BFFB8" />
      <polygon points="43,10 54,23 39,23" fill="#3EE57A" />
      <polygon points="10,23 25,23 32,56" fill="#00D45A" />
      <polygon points="25,23 39,23 32,56" fill="#26F06E" />
      <polygon points="39,23 54,23 32,56" fill="#009E43" />
      <polygon points="23,13 30,13 27,19" fill="#FFFFFF" opacity="0.75" />
    </svg>
  );
}

/** Red mine. */
export function MineIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g stroke="#7A0E1C" strokeWidth="5" strokeLinecap="round">
        <line x1="32" y1="8" x2="32" y2="56" /><line x1="8" y1="32" x2="56" y2="32" />
        <line x1="15" y1="15" x2="49" y2="49" /><line x1="49" y1="15" x2="15" y2="49" />
      </g>
      <circle cx="32" cy="32" r="17" fill="#C8102E" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#FF5A6E" strokeWidth="2" opacity="0.6" />
      <circle cx="26" cy="26" r="5.5" fill="#FF8C99" opacity="0.85" />
      <circle cx="24.5" cy="24.5" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

export default function MinesPage({ mobile, balance, onBack, onBalances }: {
  mobile: string; balance: number; onBack: () => void; onBalances: (b: Balances) => void;
}) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState(10);
  const [mines, setMines] = useState(3);
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [win, setWin] = useState<{ mult: number; payout: number } | null>(null);
  const [bets, setBets] = useState<MinesBet[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showFair, setShowFair] = useState(false);

  const loadBets = useCallback(() => {
    if (!mobile) return;
    gamesGet<{ bets: MinesBet[] }>(`/api/games/instant/my-bets?mobile=${mobile}&game=mines&limit=20`).then(d => setBets(d.bets || [])).catch(() => {});
  }, [mobile]);

  useEffect(() => {
    gamesGet<{ config: Config; rules: string[] }>('/api/games/instant/mines/state')
      .then(d => { setCfg(d.config); setRules(d.rules); setAmount(a => Math.max(a, d.config.minBet)); })
      .catch(e => setLoadError(e.message || 'Could not load Mines'));
    if (mobile) {
      // carry on with a game left open (page closed or refreshed)
      gamesGet<{ game: Game | null }>(`/api/games/mines/active?mobile=${mobile}`).then(d => {
        if (d.game) { setGame(d.game); setAmount(d.game.amount); setMines(d.game.mines); }
      }).catch(() => {});
    }
    loadBets();
  }, [mobile, loadBets]);

  const playing = game?.status === 'playing';
  const over = !!game && game.status !== 'playing';

  const start = async () => {
    if (!cfg || busy) return;
    if (!mobile) { setMsg({ ok: false, text: 'Please log in to play.' }); return; }
    if (amount > balance + 0.001) { setMsg({ ok: false, text: `Not enough balance for ${rupees(amount, 0)}.` }); return; }
    setBusy(true); setMsg(null); setWin(null);
    try {
      const d = await gamesPost<{ game: Game; balances: Balances }>('/api/games/mines/start', { mobile, amount, mines });
      setGame(d.game);
      onBalances(d.balances);
    } catch (e: any) { setMsg({ ok: false, text: e.message || 'Could not start' }); }
    setBusy(false);
  };

  const finish = (g: Game, payout: number, balances: Balances | null) => {
    setGame(g);
    if (balances) onBalances(balances);
    if (g.status === 'cashed') setWin({ mult: g.multiplier, payout });
    loadBets();
  };

  const open = async (tile: number) => {
    if (!playing || busy || game!.picks.includes(tile)) return;
    setBusy(true); setOpening(tile); setMsg(null);
    try {
      const d = await gamesPost<{ game: Game; hitMine: boolean; payout?: number; balances?: Balances; auto?: string }>('/api/games/mines/reveal', { mobile, tile });
      if (d.game.status === 'playing') setGame(d.game);
      else {
        finish(d.game, d.payout || 0, d.balances || null);
        if (d.auto) setMsg({ ok: true, text: d.auto === 'all gems found' ? 'All gems found!' : 'Max profit reached: cashed out.' });
      }
    } catch (e: any) { setMsg({ ok: false, text: e.message || 'Could not open the tile' }); }
    setOpening(null); setBusy(false);
  };

  const cashOut = async () => {
    if (!playing || busy || !game!.picks.length) return;
    setBusy(true); setMsg(null);
    try {
      const d = await gamesPost<{ game: Game; payout: number; balances: Balances }>('/api/games/mines/cashout', { mobile });
      finish(d.game, d.payout, d.balances);
    } catch (e: any) { setMsg({ ok: false, text: e.message || 'Could not cash out' }); }
    setBusy(false);
  };

  const randomPick = () => {
    if (!playing) return;
    const free = Array.from({ length: 25 }, (_, i) => i).filter(i => !game!.picks.includes(i));
    if (free.length) open(free[Math.floor(Math.random() * free.length)]);
  };

  const rows: HistoryRow[] = useMemo(() => bets.map(b => ({
    id: b.id, amount: b.amount, multiplier: b.multiplier || null, payout: b.win_amount, status: b.status,
    what: <span>{b.mines} mine{b.mines === 1 ? '' : 's'} <span className="text-nv-mute">· {b.status === 'pending' ? 'in play' : `${(b.picks || []).length} gem${(b.picks || []).length === 1 ? '' : 's'}`}</span></span>
  })), [bets]);

  if (!cfg) {
    return (
      <GameScreen title="Mines" balance={balance} onBack={onBack}>
        <p className="py-24 text-center text-[13px] text-nv-mute">{loadError || 'Loading Mines…'}</p>
      </GameScreen>
    );
  }

  const profit = game && playing ? Math.max(-game.amount, game.cashout - game.amount) : 0;
  const tile = (i: number) => {
    const picked = !!game && game.picks.includes(i);
    const mineHere = !!game?.minesAt && game.minesAt.includes(i);
    const hit = game?.hit === i;
    if (picked || over) {
      const showMine = over && mineHere;
      const dim = over && !picked && !hit;
      return (
        <div key={i} className={`flex aspect-square items-center justify-center rounded-lg ${hit ? 'bg-nv-red/25 ring-2 ring-nv-red' : 'bg-[#071824]'}`}>
          {showMine
            ? <MineIcon className={`g-pop h-[62%] w-[62%] ${dim ? 'opacity-40' : ''}`} />
            : <GemIcon className={`g-pop h-[58%] w-[58%] ${dim ? 'opacity-35' : 'drop-shadow-[0_0_10px_rgba(31,214,95,0.55)]'}`} />}
        </div>
      );
    }
    return (
      <button key={i} onClick={() => open(i)} disabled={!playing || busy} aria-label={`Tile ${i + 1}`}
        className={`nv-tap aspect-square rounded-lg bg-nv-edge shadow-[0_5px_0_#1B2C38] transition-all duration-150 enabled:hover:-translate-y-0.5 enabled:hover:bg-[#557086] enabled:active:translate-y-0.5 enabled:active:shadow-[0_2px_0_#1B2C38] disabled:cursor-default ${opening === i ? 'animate-pulse bg-[#557086]' : ''} ${!playing && !busy ? 'opacity-90' : ''}`} />
    );
  };

  return (
    <GameScreen title="Mines" balance={balance} onBack={onBack}>
      <PausedNote show={!cfg.enabled} />
      <GameBox
        panel={(
          <>
            <BetAmount value={amount} onChange={setAmount} min={cfg.minBet} max={cfg.maxBet} balance={balance} disabled={playing || busy} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mines">
                <label className={`relative flex h-11 items-center rounded-md bg-nv-input ring-1 ring-nv-edge ${playing ? 'opacity-60' : ''}`}>
                  <select value={mines} disabled={playing || busy} onChange={e => setMines(parseInt(e.target.value, 10))}
                    className="h-full w-full appearance-none bg-transparent px-3 text-[14px] font-semibold text-white focus:outline-none">
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(n => <option key={n} value={n} className="bg-nv-input">{n}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-nv-mute" />
                </label>
              </Field>
              <Field label="Gems">
                <ReadBox>{25 - (game && playing ? game.mines : mines)}</ReadBox>
              </Field>
            </div>
            {playing ? (
              <>
                <PlayButton tone="green" onClick={cashOut} busy={busy && opening === null} disabled={!game!.picks.length}>
                  {game!.picks.length ? `Cash Out ${rupees(game!.cashout)}` : 'Open a tile'}
                </PlayButton>
                <PlayButton tone="grey" onClick={randomPick} disabled={busy}><Shuffle className="mr-2 h-4 w-4" />Random Pick</PlayButton>
                <Field label={`Total Profit (${game!.multiplier.toFixed(2)}×)`} right={rupees(profit)}>
                  <ReadBox tone={profit >= 0 ? 'text-nv-green' : 'text-nv-red'}>{rupees(game!.cashout)}</ReadBox>
                </Field>
              </>
            ) : (
              <PlayButton onClick={start} busy={busy} disabled={!cfg.enabled}>Bet</PlayButton>
            )}
            <Notice msg={msg} />
          </>
        )}
        stage={(
          <div className="flex h-full flex-col items-center justify-center gap-4 p-3 sm:p-6 lg:min-h-[520px]">
            <div className="relative grid w-full max-w-[460px] grid-cols-5 gap-2 sm:gap-2.5">
              {Array.from({ length: 25 }, (_, i) => tile(i))}
              {win && over && game?.status === 'cashed' && (
                <button onClick={() => setWin(null)} className="g-pop absolute left-1/2 top-1/2 flex w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl bg-nv-panel/95 px-4 py-4 shadow-2xl ring-4 ring-nv-green">
                  <span className="text-[30px] font-bold tabular-nums text-nv-green">{win.mult.toFixed(2)}×</span>
                  <span className="mt-1 h-px w-12 bg-nv-edge" />
                  <span className="mt-1.5 text-[15px] font-semibold tabular-nums text-white">{rupees(win.payout)}</span>
                </button>
              )}
            </div>
            <div className="flex min-h-[32px] flex-wrap items-center justify-center gap-2 text-[12.5px]">
              {playing ? (
                <>
                  <span className="rounded-full bg-nv-panel px-3 py-1 font-semibold text-nv-text">Now <b className="text-white">{game!.multiplier.toFixed(2)}×</b></span>
                  {game!.next && <span className="rounded-full bg-nv-panel px-3 py-1 font-semibold text-nv-text">Next gem <b className="text-nv-green">{game!.next.toFixed(2)}×</b></span>}
                </>
              ) : over && game?.status === 'busted' ? (
                <span className="rounded-full bg-nv-red/15 px-3 py-1 font-semibold text-nv-red">Mine! Bet lost · tap Bet to play again</span>
              ) : over && game?.status === 'cashed' ? (
                <span className="rounded-full bg-nv-green/15 px-3 py-1 font-semibold text-nv-green">Cashed out at {game.multiplier.toFixed(2)}× · tap Bet to play again</span>
              ) : (
                <span className="rounded-full bg-nv-panel px-3 py-1 font-semibold text-nv-mute">Pick the mines, place a bet, then open tiles</span>
              )}
            </div>
          </div>
        )}
        footer={<GameFooter name="Mines" onRules={() => setShowRules(true)} onFairness={() => setShowFair(true)} />}
      />

      <BetsTable rows={rows} />

      <NvModal open={showRules} onClose={() => setShowRules(false)} title="How Mines works">
        <RulesList lines={rules} />
      </NvModal>
      <FairnessModal open={showFair} onClose={() => setShowFair(false)} mobile={mobile} game="mines" />
    </GameScreen>
  );
}
