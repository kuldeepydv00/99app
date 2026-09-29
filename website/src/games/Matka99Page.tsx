import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { gamesGet, gamesPost } from './api';
import { inr, OptionTag, GlassCard, AmountPicker, StatusPill, Sheet } from './ui';
import type { Balances } from './TradingPage';

type Market = { key: string; name: string; open: string | null; close: string | null; resultTime: string | null; enabled: boolean; isOpen: boolean; cycleDate: string; lastResult: { number: string; date: string; winningTotal?: number; tiedCount?: number } | null };
type MarketsResp = { payout: number; minBet: number; maxBet: number; markets: Market[]; ruleLine?: string; rules?: string[] };
type Bet = { id: string; market: string; marketName: string; dateKey: string; option: string; amount: number; status: string; win_amount: number; result: string | null; created_at: string };

const ALL = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

export default function Matka99Page({ marketKey, mobile, balance, onBack, onBalances }: {
  marketKey: string; mobile: string; balance: number; onBack: () => void; onBalances: (b: Balances) => void;
}) {
  const [data, setData] = useState<MarketsResp | null>(null);
  const [mode, setMode] = useState<'jodi' | 'crossing'>('jodi');
  const [showRules, setShowRules] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [digits, setDigits] = useState('');
  const [withJoda, setWithJoda] = useState(true);
  const [amount, setAmount] = useState(10);
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [myBets, setMyBets] = useState<Bet[]>([]);

  const load = useCallback(() => gamesGet<MarketsResp>('/api/games/matka99/markets').then(setData).catch(() => {}), []);
  const loadBets = useCallback(() => {
    if (!mobile) return;
    gamesGet<{ bets: Bet[] }>(`/api/games/matka99/my-bets?mobile=${mobile}`).then(d => setMyBets(d.bets || [])).catch(() => {});
  }, [mobile]);

  useEffect(() => {
    load(); loadBets();
    const a = setInterval(load, 15000);
    const b = setInterval(loadBets, 20000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [load, loadBets]);

  const market = data?.markets.find(m => m.key === marketKey) || null;

  const crossingNumbers = useMemo(() => {
    const ds = Array.from(new Set(digits.replace(/[^0-9]/g, '').split('')));
    const out: string[] = [];
    ds.forEach(a => ds.forEach(b => { if (a !== b || withJoda) out.push(a + b); }));
    return out;
  }, [digits, withJoda]);

  const numbers = mode === 'jodi' ? picked : crossingNumbers;
  const total = numbers.length * amount;
  const marketBets = myBets.filter(b => b.market === marketKey);

  const toggle = (n: string) => { setMsg(null); setPicked(p => (p.includes(n) ? p.filter(x => x !== n) : [...p, n])); };

  const place = async () => {
    if (!market || numbers.length === 0 || placing) return;
    if (!mobile) { setMsg({ ok: false, text: 'Please log in to place bets.' }); return; }
    if (total > balance + 0.001) { setMsg({ ok: false, text: `Not enough balance. You need ${inr(total)}.` }); return; }
    setPlacing(true); setMsg(null);
    try {
      const d = await gamesPost<{ balances: Balances }>('/api/games/matka99/bet', {
        mobile, market: market.key, bets: numbers.map(n => ({ number: n, amount }))
      });
      onBalances(d.balances);
      setMsg({ ok: true, text: `Bet placed on ${numbers.length} ${numbers.length === 1 ? 'number' : 'numbers'} · ${inr(total)}` });
      setPicked([]); setDigits('');
      loadBets();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Could not place bet' });
    }
    setPlacing(false);
  };

  const closed = !!market && !market.isOpen;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#06120C] text-white">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-800/80 bg-[#0A0F0D]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 text-gray-300 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h2 className="text-base font-black tracking-wide">{market?.name || '99x Matka'}</h2>
            <p className="text-[10px] font-semibold text-[#E0B7A0]">99x Matka · fixed 99x payout</p>
          </div>
        </div>
        <span className="rounded-full border border-[#C9A87C]/40 bg-[#0C241B] px-3 py-1 text-xs font-extrabold tabular-nums text-[#F0DDB8]">{inr(balance)}</span>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 pb-44 pt-4">
        <GlassCard className="g-rise relative overflow-hidden border-[#E0B7A0]/40 p-4">
          <span className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#E0B7A0]/15 blur-2xl" />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="g-shimmer text-2xl font-black">{market?.name || '…'}</h3>
              <p className="mt-1 text-[11px] text-gray-400">{market ? `Open ${market.open} · Close ${market.close} · Result ${market.resultTime || market.close}` : 'Loading…'}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#F5EDE2]">99x</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">every win</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {market && <StatusPill status={market.isOpen ? 'open' : 'locked'} />}
            {market?.lastResult && <span className="flex items-center gap-1.5 text-[11px] text-gray-400">Last result <OptionTag game="number" value={market.lastResult.number} /></span>}
          </div>
          {market?.lastResult?.tiedCount !== undefined && (
            <p className="mt-1.5 text-[10px] text-gray-500">
              {market.lastResult.date}: {inr(market.lastResult.winningTotal || 0)} was bet on {market.lastResult.number}
              {market.lastResult.tiedCount > 1 ? ` · picked at random from ${market.lastResult.tiedCount} numbers tied for lowest` : ' · lowest of all 100 numbers'}
            </p>
          )}
          <p className="mt-3 text-xs font-semibold leading-snug text-gray-200">{data?.ruleLine || 'Result at the market’s result time: the number with the lowest total bet wins. Ties are picked at random.'}</p>
          <button onClick={() => setShowRules(true)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#E0C9A0] hover:text-white">
            <Info className="h-3.5 w-3.5" /> How it works
          </button>
        </GlassCard>

        {closed && (
          <div className="rounded-xl border border-gray-700 bg-white/5 px-4 py-3 text-center text-xs font-bold text-gray-300">
            Betting is closed for {market?.name}. It opens again at {market?.open}.
          </div>
        )}

        <div className="flex rounded-xl border border-[#1E5C46] bg-[#0A0F0D] p-1">
          {(['jodi', 'crossing'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setMsg(null); }}
              className={`flex-1 rounded-lg py-2 text-xs font-extrabold capitalize transition-all ${mode === m ? 'bg-gradient-to-r from-[#F5EDE2] to-[#E0B7A0] text-[#0A0F0D] shadow' : 'text-gray-400 hover:text-white'}`}>
              {m}
            </button>
          ))}
        </div>

        {mode === 'jodi' ? (
          <div className={`grid grid-cols-10 gap-1.5 ${closed ? 'pointer-events-none opacity-40' : ''}`}>
            {ALL.map(n => {
              const on = picked.includes(n);
              return (
                <button key={n} onClick={() => toggle(n)}
                  className={`aspect-square rounded-lg font-mono text-xs font-extrabold transition-all duration-150 active:scale-90 ${on ? 'bg-gradient-to-br from-[#F5EDE2] to-[#E0B7A0] text-[#0A0F0D] shadow-[0_0_14px_rgba(224,183,160,0.6)]' : 'border border-[#1E5C46] bg-[#0C241B] text-gray-200 hover:border-[#E0B7A0]/70 hover:text-white'}`}>
                  {n}
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`space-y-3 ${closed ? 'pointer-events-none opacity-40' : ''}`}>
            <input inputMode="numeric" value={digits} maxLength={10} placeholder="Type digits, e.g. 247"
              onChange={e => setDigits(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-xl border border-[#1E5C46] bg-[#0A0F0D] px-4 py-3 text-center font-mono text-xl font-extrabold tracking-[0.4em] text-white placeholder:text-sm placeholder:tracking-normal placeholder-gray-600 focus:border-[#E0B7A0] focus:outline-none" />
            <label className="flex items-center justify-between rounded-xl border border-[#1E5C46] bg-[#0C241B] px-4 py-2.5 text-xs font-bold text-gray-300">
              Include doubles (Joda) like 22, 44
              <input type="checkbox" checked={withJoda} onChange={e => setWithJoda(e.target.checked)} />
            </label>
            {crossingNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {crossingNumbers.map(n => <OptionTag key={n} game="number" value={n} />)}
              </div>
            )}
          </div>
        )}

        <AmountPicker value={amount} onChange={setAmount} min={data?.minBet || 10} max={data?.maxBet || 10000} />

        {marketBets.length > 0 && (
          <div className="rounded-2xl border border-gray-800 bg-[#0A0F0D]">
            <p className="border-b border-gray-800 px-3 py-2 text-xs font-bold text-white">Your {market?.name} bets</p>
            {marketBets.slice(0, 30).map(b => (
              <div key={b.id} className="flex items-center justify-between border-b border-gray-900 px-3 py-2 last:border-0">
                <div className="flex items-center gap-2">
                  <OptionTag game="number" value={b.option} />
                  <span className="text-[11px] text-gray-400">{inr(b.amount)} · {b.dateKey}</span>
                </div>
                {b.status === 'won'
                  ? <span className="text-xs font-extrabold text-[#3EE08A]">+{inr(b.win_amount)}</span>
                  : b.status === 'lost'
                    ? <span className="flex items-center gap-1 text-[11px] text-gray-500">Result <OptionTag game="number" value={b.result} /></span>
                    : b.status === 'refunded'
                      ? <span className="text-[11px] font-bold text-sky-300">Refunded</span>
                      : <span className="text-[11px] font-bold text-amber-400">Pending</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E0B7A0]/30 bg-[#0A0F0D]/95 px-4 pb-5 pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-md space-y-2">
          {msg && <p className={`text-center text-xs font-bold ${msg.ok ? 'text-[#3EE08A]' : 'text-[#FF6B7E]'}`}>{msg.text}</p>}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{numbers.length === 0 ? 'Pick numbers to bet' : `${numbers.length} × ${inr(amount)}`}</span>
            <span className="font-bold text-white">Total <span className="tabular-nums text-[#F5EDE2]">{inr(total)}</span></span>
          </div>
          {numbers.length > 0 && <p className="text-center text-[10px] text-gray-500">If your number comes: {inr(amount * 99)}</p>}
          <button onClick={place} disabled={numbers.length === 0 || placing || closed}
            className="w-full rounded-xl bg-gradient-to-r from-[#F5EDE2] via-[#E8CDB8] to-[#E0B7A0] py-3.5 text-sm font-extrabold tracking-wide text-[#0A0F0D] shadow-lg shadow-[#E0B7A0]/20 transition-transform active:scale-[0.98] disabled:opacity-40">
            {placing ? 'Placing…' : closed ? 'Betting closed' : 'PLACE BET'}
          </button>
        </div>
      </div>
      <Sheet open={showRules} onClose={() => setShowRules(false)} title="How 99x Matka works">
        <ul className="space-y-2.5 text-xs leading-relaxed text-gray-300">
          {(data?.rules || []).map((line, i) => (
            <li key={i} className="flex gap-2"><span className="text-[#E0B7A0]">•</span><span>{line}</span></li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
