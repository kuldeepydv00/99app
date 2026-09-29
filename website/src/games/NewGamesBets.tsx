import { useEffect, useState } from 'react';
import { gamesGet } from './api';
import { inr, OptionTag } from './ui';

type Bet = { id: string; game: string; option: string; amount: number; status: string; win_amount: number; result: string | null; created_at: string; roundId?: string; marketName?: string; dateKey?: string };
type Filter = 'all' | 'matka99' | 'number' | 'card' | 'colour';

const LABEL: Record<string, string> = { matka99: '99x Matka', number: 'Number', card: 'Card', colour: 'Colour' };

export default function NewGamesBets({ mobile }: { mobile: string }) {
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    if (!mobile) { setBets([]); return; }
    let alive = true;
    const load = () => gamesGet<{ bets: Bet[] }>(`/api/games/my-bets?mobile=${mobile}`).then(d => { if (alive) setBets(d.bets || []); }).catch(() => { if (alive) setBets([]); });
    load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [mobile]);

  const list = (bets || []).filter(b => filter === 'all' || b.game === filter);
  return (
    <div className="space-y-3">
      <div className="g-noscroll flex gap-2 overflow-x-auto">
        {(['all', 'matka99', 'number', 'card', 'colour'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${filter === f ? 'bg-[#C9A87C] text-slate-950' : 'border border-gray-800 bg-[#123A2C] text-gray-300'}`}>
            {f === 'all' ? 'All' : LABEL[f]}
          </button>
        ))}
      </div>
      {bets === null ? <p className="py-6 text-center text-xs text-gray-500">Loading…</p> : list.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-[#0C241B] py-8 text-center text-xs font-semibold text-gray-400">No bets here yet.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0A0F0D]">
          {list.map(b => (
            <div key={b.id} className="flex items-center justify-between border-b border-gray-900 px-3 py-2.5 last:border-0">
              <div className="flex items-center gap-2.5">
                <OptionTag game={b.game === 'matka99' ? 'number' : b.game} value={b.option} />
                <div>
                  <p className="text-xs font-bold text-white">{b.game === 'matka99' ? b.marketName : LABEL[b.game]} · {inr(b.amount)}</p>
                  <p className="font-mono text-[10px] text-gray-500">{b.game === 'matka99' ? b.dateKey : b.roundId}</p>
                </div>
              </div>
              {b.status === 'won'
                ? <span className="text-xs font-extrabold text-[#3EE08A]">+{inr(b.win_amount)}</span>
                : b.status === 'lost'
                  ? <span className="flex items-center gap-1 text-[10px] text-gray-500">Result <OptionTag game={b.game === 'matka99' ? 'number' : b.game} value={b.result} /></span>
                  : b.status === 'refunded'
                      ? <span className="text-[11px] font-bold text-sky-300">Refunded</span>
                      : <span className="text-[11px] font-bold text-amber-400">Pending</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
