import { memo, useId, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { dragonSvg, tigerSvg, DT_ART_CSS } from './dtArt';

export type Mood = 'idle' | 'tense' | 'win' | 'lose';

/** The creature animation CSS. Rendering it more than once on a page is harmless. */
export function DtArtStyle() {
  return <style>{DT_ART_CSS}</style>;
}

/** Animated dragon or tiger head. The SVG markup never changes; the mood is a class on the wrapper. */
export const Creature = memo(function Creature({ kind, mood, className = '', style }: {
  kind: 'dragon' | 'tiger'; mood: Mood; className?: string; style?: CSSProperties;
}) {
  const id = 'dt' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const html = useMemo(() => (kind === 'dragon' ? dragonSvg(id) : tigerSvg(id)), [kind, id]);
  return (
    <div className={`dtart ${mood === 'idle' ? '' : 'dt-' + mood} ${className}`} style={style}>
      <svg viewBox="0 0 400 400" className="block h-full w-full" aria-label={kind === 'dragon' ? 'Dragon' : 'Tiger'} role="img"
        dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
});

/**
 * Home-page picture for Dragon Tiger: the banner background (title and lights) with the live,
 * animated dragon and tiger on top. Positions match the 1200x680 banner layout.
 */
export function DragonTigerBanner({ className = '' }: { className?: string }) {
  const gid = 'vs' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div className={`relative h-full w-full ${className}`}>
      <DtArtStyle />
      <img src="/banners/banner_dragontiger_bg.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <Creature kind="dragon" mood="idle" className="absolute" style={{ left: '51%', top: '17.4%', width: '26.7%', aspectRatio: '1 / 1' }} />
      <Creature kind="tiger" mood="idle" className="absolute" style={{ left: '75%', top: '19.4%', width: '24.2%', aspectRatio: '1 / 1' }} />
      <svg viewBox="0 0 80 80" className="absolute" style={{ left: '73.2%', top: '34.1%', width: '6.5%' }} aria-hidden="true">
        <defs>
          <radialGradient id={gid} cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#FFF6DF" /><stop offset=".45" stopColor="#E0C9A0" /><stop offset="1" stopColor="#8A6D47" />
          </radialGradient>
        </defs>
        <circle cx="40" cy="40" r="36" fill={`url(#${gid})`} stroke="#FFF3B0" strokeOpacity=".75" strokeWidth="3" />
        <text x="40" y="51" textAnchor="middle" fontSize="30" fontWeight="900" fontStyle="italic" fill="#2A1B08" fontFamily="Poppins, sans-serif">VS</text>
      </svg>
    </div>
  );
}
