import type { ReactNode } from 'react';

/**
 * Square market tile used by the Matka and 99x Matka home grids.
 * Same shape, spacing and hover as the Trading tiles so all three sections read as one set.
 */
export type TileState =
  | { kind: 'open'; note?: string }     // betting open (note e.g. "Closes 5:40 PM")
  | { kind: 'urgent'; note: string }    // betting open, closing soon (note e.g. "12 min left")
  | { kind: 'closed'; result: string | null; note?: string }; // betting closed, result or pending

export const shortTime = (t?: string | null) =>
  (t || '').replace(/\s*IST\s*$/i, '').replace(/^0(\d:)/, '$1').trim();

export default function MarketTile({ icon, name, sub, state, cta = 'PLAY', accent = 'gold', onClick, delay = 0 }: {
  icon: ReactNode;
  name: string;
  sub?: string;
  state: TileState;
  cta?: string;
  accent?: 'gold' | 'rose';
  onClick: () => void;
  delay?: number;
}) {
  const closed = state.kind === 'closed';
  const rose = accent === 'rose';
  const border = rose ? 'border-[#E0B7A0]/30 hover:border-[#E0B7A0]/80' : 'border-[#C9A87C]/25 hover:border-[#C9A87C]/70';
  const glow = closed ? 'from-white/[0.04]' : rose ? 'from-[#E0B7A0]/20' : 'from-[#1E5C46]/60';

  return (
    <button onClick={onClick} style={{ animationDelay: `${delay}ms` }}
      className={`g-rise g-lift relative flex flex-col items-center overflow-hidden rounded-2xl border bg-gradient-to-b ${glow} to-[#0A0F0D] px-2 pb-2.5 pt-3.5 text-center shadow-xl ${border}`}>
      {/* visual */}
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-inner ${rose ? 'border-[#E0B7A0]/60 bg-gradient-to-br from-[#2A2320] to-[#0A0F0D] text-[13px] font-black text-[#F5EDE2]' : 'border-[#C9A87C]/50 bg-gradient-to-br from-[#123A2C] to-[#0A0F0D] text-xl'} ${closed ? 'opacity-70' : ''}`}>
        {icon}
      </div>

      {/* name: fixed two-line box so every tile lines up */}
      <div className="mt-2 flex h-[30px] w-full items-center justify-center">
        <p className="line-clamp-2 text-[12.5px] font-extrabold leading-[1.15] text-white">{name}</p>
      </div>
      {sub && <p className="w-full truncate text-[9px] font-medium text-gray-400">{sub}</p>}

      {/* status */}
      {state.kind === 'open' && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#3EE08A]/15 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#3EE08A]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3EE08A]" />Open
        </span>
      )}
      {state.kind === 'urgent' && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#C9A87C]/20 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#F0DDB8]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F0DDB8]" />{state.note}
        </span>
      )}
      {closed && (
        <span className="mt-1.5 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-gray-300">
          Closed
        </span>
      )}
      {state.kind === 'open' && state.note && <p className="mt-1 text-[9px] font-semibold text-gray-400">{state.note}</p>}

      {/* footer */}
      <div className="mt-auto w-full pt-2">
        {closed ? (
          state.result ? (
            <span className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-[#C9A87C]/40 bg-[#0A0F0D] text-[9px] font-bold text-gray-400">
              Result <span className="font-mono text-sm font-black text-[#F0DDB8]">{state.result}</span>
            </span>
          ) : (
            <span className="flex h-7 w-full items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-[9px] font-extrabold uppercase text-amber-400">
              {state.note ? `Result ${state.note}` : 'Pending'}
            </span>
          )
        ) : (
          <span className={`flex h-7 w-full items-center justify-center rounded-lg text-[10.5px] font-black tracking-wider text-[#0A0F0D] shadow-lg ${rose ? 'bg-gradient-to-r from-[#F5EDE2] to-[#E0B7A0]' : 'bg-gradient-to-r from-[#F0DDB8] via-[#C9A87C] to-[#8A6D47]'}`}>
            {cta} →
          </span>
        )}
      </div>
    </button>
  );
}
