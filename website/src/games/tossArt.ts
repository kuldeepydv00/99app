// Toss coin art: SVG faces (gold coin, red HEAD with crown, blue TAIL with star) and the CSS for the
// 3D coin (thick edge from stacked layers) and its animations: idle hover, tense shake, flip, landing.
/* eslint-disable */

// Toss coin art. coinFaceSvg(side, p) returns a full <svg> (200x200) for one face.
export function coinFaceSvg(side: 'HEAD' | 'TAIL', p: string): string {
  const head = side === 'HEAD';
  const enamel = head ? ['#FF6B6B', '#C81E3A', '#6E0A1C'] : ['#7DB4FF', '#2457C5', '#0B2463'];
  let ticks = '';
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    ticks += `M${(100 + 91.5 * c).toFixed(2)} ${(100 + 91.5 * s).toFixed(2)}L${(100 + 97 * c).toFixed(2)} ${(100 + 97 * s).toFixed(2)}`;
  }
  let dots = '';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    dots += `<circle cx="${(100 + 74 * Math.cos(a)).toFixed(2)}" cy="${(100 + 74 * Math.sin(a)).toFixed(2)}" r="1.4"/>`;
  }
  // emblem
  let emblem: string;
  if (head) {
    emblem = `<path d="M64 116 L57 76 L80 95 L100 62 L120 95 L143 76 L136 116 Z"/>
      <rect x="62" y="116" width="76" height="13" rx="3"/>
      <circle cx="57" cy="74" r="5.5"/><circle cx="100" cy="59" r="6"/><circle cx="143" cy="74" r="5.5"/>`;
  } else {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 13 : 32, a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push(`${(100 + r * Math.cos(a)).toFixed(1)} ${(98 + r * Math.sin(a)).toFixed(1)}`);
    }
    let leaves = '';
    for (let i = 0; i < 6; i++) {
      const deg = 138 + i * 16;
      const a = deg * Math.PI / 180;
      const x = 100 + 47 * Math.cos(a), y = 92 + 47 * Math.sin(a);
      const rot = deg + 90 + 25;
      leaves += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.8" ry="8" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      const x2 = 200 - x;
      leaves += `<ellipse cx="${x2.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.8" ry="8" transform="rotate(${-rot} ${x2.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
    emblem = `<path d="M${pts.join(' L')} Z"/>${leaves}`;
  }
  const label = head ? 'HEAD' : 'TAIL';
  const emboss = (inner: string) => `
    <g transform="translate(1.6 1.8)" fill="#5E3F06" opacity=".55">${inner}</g>
    <g transform="translate(-1 -1.2)" fill="#FFF7D1" opacity=".8">${inner}</g>
    <g fill="url(#${p}-relief)">${inner}</g>`;
  const word = `<text x="100" y="${head ? 154 : 152}" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-weight="900" font-size="23" letter-spacing="4">${label}</text>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${p}-gold" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#FFF6C8"/><stop offset=".35" stop-color="#F6CD55"/><stop offset=".7" stop-color="#C9921E"/><stop offset="1" stop-color="#7A5208"/></radialGradient>
    <radialGradient id="${p}-inner" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FFE48A"/><stop offset=".6" stop-color="#E2AE36"/><stop offset="1" stop-color="#A9761A"/></radialGradient>
    <radialGradient id="${p}-enamel" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${enamel[0]}"/><stop offset=".55" stop-color="${enamel[1]}"/><stop offset="1" stop-color="${enamel[2]}"/></radialGradient>
    <linearGradient id="${p}-relief" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1B0"/><stop offset=".5" stop-color="#E9B949"/><stop offset="1" stop-color="#B07E1E"/></linearGradient>
    <linearGradient id="${p}-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <circle cx="100" cy="100" r="99" fill="url(#${p}-gold)"/>
  <path d="${ticks}" stroke="#8A6512" stroke-width="1.6" opacity=".75"/>
  <circle cx="100" cy="100" r="90" fill="none" stroke="#7A5208" stroke-width="2"/>
  <circle cx="100" cy="100" r="88" fill="url(#${p}-inner)"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="#FFF3B0" stroke-width="1.5" opacity=".6"/>
  <g fill="#8A6512" opacity=".7">${dots}</g>
  <circle cx="100" cy="100" r="64" fill="url(#${p}-enamel)" stroke="#7A5208" stroke-width="2.5"/>
  <circle cx="100" cy="100" r="64" fill="none" stroke="#FFF3B0" stroke-width="1" opacity=".5"/>
  ${emboss(emblem)}
  ${emboss(word)}
  <path d="M30 70 A75 75 0 0 1 120 22 A90 90 0 0 0 30 70 Z" fill="#fff" opacity=".25"/>
  <circle cx="100" cy="100" r="99" fill="url(#${p}-shine)"/>
</svg>`;
}

export const TOSS_CSS = `
/* Toss coin: .tc-scene > .tc-shadow + .tc-toss > .tc-coin > .tc-layer* + .tc-face.tc-head + .tc-face.tc-tail */
.tc-scene{position:relative;width:var(--tc-size,180px);height:calc(var(--tc-size,180px) * 1.75);perspective:900px}
.tc-shadow{position:absolute;left:50%;bottom:4%;width:70%;height:9%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.6),transparent);transition:transform .3s}
.tc-toss{position:absolute;left:0;right:0;bottom:12%;height:var(--tc-size,180px);transform-style:preserve-3d}
.tc-coin{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(var(--tc-from,0deg))}
.tc-face,.tc-layer{position:absolute;inset:0;border-radius:50%;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.tc-face svg{display:block;width:100%;height:100%}
.tc-head{transform:translateZ(calc(var(--tc-size,180px) * .045))}
.tc-tail{transform:rotateX(180deg) translateZ(calc(var(--tc-size,180px) * .045))}
.tc-layer{backface-visibility:visible;-webkit-backface-visibility:visible;background:radial-gradient(circle,#B8862A 0 60%,#8A6212 70%,#5E4008 100%)}
.tc-glow{position:absolute;left:50%;bottom:12%;width:var(--tc-size,180px);height:var(--tc-size,180px);transform:translateX(-50%);border-radius:50%;opacity:0;pointer-events:none}
/* idle: hover and turn gently */
.tc-idle .tc-toss{animation:tc-hover 3.2s ease-in-out infinite}
.tc-idle .tc-coin{animation:tc-wobble 5s ease-in-out infinite}
/* tense: shake on the thumb */
.tc-tense .tc-toss{animation:tc-shake .32s ease-in-out infinite}
.tc-tense .tc-glow{opacity:.55;background:radial-gradient(closest-side,rgba(255,214,102,.55),transparent);animation:tc-pulse .7s ease-in-out infinite}
/* toss: up and down with many flips, lands on the result */
.tc-flip .tc-toss{animation:tc-arc 2.3s cubic-bezier(.3,0,.3,1) forwards}
.tc-flip .tc-coin{animation:tc-spin 2.3s cubic-bezier(.2,.6,.25,1) forwards}
.tc-flip .tc-shadow{animation:tc-shrink 2.3s cubic-bezier(.3,0,.3,1) forwards}
/* landed: winner glow and sparkles */
.tc-landed .tc-coin{transform:rotateX(var(--tc-end,0deg))}
.tc-landed .tc-toss{animation:tc-land .5s ease-out}
.tc-landed .tc-glow{opacity:1;background:radial-gradient(closest-side,var(--tc-glow,#FFD666),transparent);animation:tc-pulse 1.2s ease-in-out infinite}
.tc-spark{position:absolute;left:50%;bottom:calc(12% + var(--tc-size,180px) / 2);width:7px;height:7px;margin:-3.5px;border-radius:50%;background:#FFF3B0;box-shadow:0 0 8px 2px #FFD666;opacity:0;pointer-events:none}
.tc-landed .tc-spark{animation:tc-burst 1s ease-out forwards}
@keyframes tc-hover{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes tc-wobble{0%,100%{transform:rotateX(calc(var(--tc-from,0deg) + 14deg)) rotateY(-12deg)}50%{transform:rotateX(calc(var(--tc-from,0deg) - 10deg)) rotateY(14deg)}}
@keyframes tc-shake{0%,100%{transform:translate(0,0) rotate(0)}25%{transform:translate(-2px,1px) rotate(-1.5deg)}75%{transform:translate(2px,-1px) rotate(1.5deg)}}
@keyframes tc-pulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.18)}}
@keyframes tc-arc{0%{transform:translateY(0) scale(1)}45%{transform:translateY(calc(var(--tc-size,180px) * -.62)) scale(1.18)}88%{transform:translateY(0) scale(1)}94%{transform:translateY(calc(var(--tc-size,180px) * -.06)) scale(1)}100%{transform:translateY(0) scale(1)}}
@keyframes tc-spin{from{transform:rotateX(var(--tc-from,0deg)) rotateY(0)}60%{transform:rotateX(calc(var(--tc-from,0deg) + (var(--tc-end,1800deg) - var(--tc-from,0deg)) * .82)) rotateY(18deg)}to{transform:rotateX(var(--tc-end,1800deg)) rotateY(0)}}
@keyframes tc-shrink{0%{transform:translateX(-50%) scale(1);opacity:1}45%{transform:translateX(-50%) scale(.45);opacity:.35}88%,100%{transform:translateX(-50%) scale(1);opacity:1}}
@keyframes tc-land{0%{transform:scale(1.08,.94)}60%{transform:scale(.98,1.03)}100%{transform:scale(1)}}
@keyframes tc-burst{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3)}}
@media (prefers-reduced-motion:reduce){.tc-scene *{animation-duration:.01s!important;animation-iteration-count:1!important}}
.tc-flash{animation:tc-flash 1.6s ease-out forwards}
@keyframes tc-flash{0%{opacity:0}12%{opacity:1}100%{opacity:.35}}
`;
