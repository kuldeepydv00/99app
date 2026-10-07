import { memo, useId, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { coinFaceSvg, TOSS_CSS } from './tossArt';

export type CoinPhase = 'idle' | 'tense' | 'flip' | 'landed';

const LAYERS = 12;
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { dx: `calc(var(--tc-size) * ${(Math.cos(a) * 0.75).toFixed(3)})`, dy: `calc(var(--tc-size) * ${(Math.sin(a) * 0.75).toFixed(3)})`, d: `${(i % 3) * 0.05}s` };
});

/** The coin CSS. Rendering it more than once on a page is harmless. */
export function TossStyle() {
  return <style>{TOSS_CSS}</style>;
}

/** Angle that shows a side face up: 0 = HEAD, 180 = TAIL. */
export const faceAngle = (side: string | null | undefined) => (side === 'TAIL' ? 180 : 0);

/**
 * 3D gold coin. `from`/`end` are rotateX angles in degrees; `size` is any CSS length.
 * idle: hovers and wobbles showing `from` · tense: shakes · flip: tossed from `from` to `end` · landed: rests on `end` and glows.
 */
export const TossCoin = memo(function TossCoin({ phase, from, end, size, glow, className = '' }: {
  phase: CoinPhase; from: number; end: number; size: string; glow?: string; className?: string;
}) {
  const id = 'tc' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const faces = useMemo(() => ({ head: coinFaceSvg('HEAD', id + 'h'), tail: coinFaceSvg('TAIL', id + 't') }), [id]);
  const style = { '--tc-size': size, '--tc-from': `${from}deg`, '--tc-end': `${end}deg`, '--tc-glow': glow || '#FFD666' } as CSSProperties;
  return (
    <div className={`tc-scene tc-${phase} ${className}`} style={style}>
      <div className="tc-shadow" />
      <div className="tc-glow" />
      <div className="tc-toss">
        <div className="tc-coin">
          {Array.from({ length: LAYERS }, (_, i) => (
            <div key={i} className="tc-layer" style={{ transform: `translateZ(calc(var(--tc-size) * ${(-0.045 + (0.09 * i) / (LAYERS - 1)).toFixed(4)}))` }} />
          ))}
          <div className="tc-face tc-head" dangerouslySetInnerHTML={{ __html: faces.head }} />
          <div className="tc-face tc-tail" dangerouslySetInnerHTML={{ __html: faces.tail }} />
        </div>
      </div>
      {phase === 'landed' && SPARKS.map((s, i) => (
        <span key={i} className="tc-spark" style={{ '--dx': s.dx, '--dy': s.dy, animationDelay: s.d } as CSSProperties} />
      ))}
    </div>
  );
});

/** A flat coin face (no animation), for buttons and badges. */
export const CoinFace = memo(function CoinFace({ side, className = '' }: { side: 'HEAD' | 'TAIL'; className?: string }) {
  const id = 'cf' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const html = useMemo(() => coinFaceSvg(side, id), [side, id]);
  return <span className={`block drop-shadow-[0_4px_8px_rgba(0,0,0,.5)] [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Home-page picture for Toss: banner background with a live coin hovering on the right. */
export function TossBanner({ className = '' }: { className?: string }) {
  return (
    <div className={`relative h-full w-full ${className}`} style={{ containerType: 'inline-size' }}>
      <TossStyle />
      <img src="/banners/banner_toss_bg.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute" style={{ left: '62%', top: '6.8%' }}>
        <TossCoin phase="idle" from={0} end={0} size="27cqw" />
      </div>
    </div>
  );
}
