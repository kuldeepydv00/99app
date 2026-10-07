// Dragon Tiger creature art: hand-drawn SVG dragon and tiger heads (front view) with CSS animation.
// Each function returns the inner markup of a 400x400 <svg>; `p` prefixes gradient/filter ids so
// several copies can sit on one page. States are classes on the wrapper: dt-tense, dt-win, dt-lose, dt-still.
/* eslint-disable */

// Tiger head, front view, 400x400. Left half is drawn once and mirrored.
export function tigerSvg(p: string): string {
  const M = (s: string) => `<g transform="translate(400 0) scale(-1 1)">${s}</g>`;
  const both = (s: string) => s + M(s);
  // deterministic fur strokes
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let fur = '';
  for (let i = 0; i < 260; i++) {
    const x = 60 + rnd() * 140, y = 95 + rnd() * 250;
    const ang = Math.atan2(y - 215, x - 200) + (rnd() - 0.5) * 0.6;
    const len = 5 + rnd() * 9;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    const light = rnd() > 0.55;
    fur += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${light ? '#FFD08A' : '#8A3A0E'}" stroke-opacity="${(0.18 + rnd() * 0.25).toFixed(2)}" stroke-width="1.3" stroke-linecap="round"/>`;
  }
  const head = `M202 70 C168 68 140 76 120 90 C102 102 88 120 78 142
    Q60 150 56 162 Q66 166 70 172 Q48 182 42 196 Q56 200 60 206 Q38 220 32 232 Q48 236 54 240 Q34 256 30 270 Q48 270 56 274 Q40 292 42 304 Q58 300 68 302 Q60 318 66 330 Q84 322 98 322
    C116 342 152 360 202 364 Z`;
  const ear = `<g class="dt-ear">
      <path d="M96 128 C70 104 62 60 86 46 C108 36 138 60 150 92 Z" fill="url(#${p}-fur)" stroke="#3B1405" stroke-width="3"/>
      <path d="M86 46 C108 36 138 60 150 92 L140 96 C130 70 110 54 92 56 Z" fill="#1F0B04" opacity=".85"/>
      <path d="M102 118 C86 98 82 72 96 64 C112 60 130 80 138 100 Z" fill="url(#${p}-earin)"/>
      <path d="M100 112 Q96 92 104 76 M110 110 Q108 92 116 80 M120 108 Q120 94 126 86" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>`;
  const stripes = `
    <path d="M170 86 Q158 112 174 136 Q168 112 180 90 Z" fill="#160803"/>
    <path d="M146 96 Q130 120 146 150 Q146 124 158 102 Z" fill="#160803"/>
    <path d="M124 110 Q110 130 120 156 Q124 134 134 118 Z" fill="#160803"/>
    <path d="M100 136 Q112 150 128 176 Q108 164 92 156 Z" fill="#160803"/>
    <path d="M84 168 Q108 172 124 186 Q102 184 80 182 Z" fill="#160803"/>
    <path d="M46 206 Q86 208 116 228 Q86 222 52 224 Z" fill="#160803"/>
    <path d="M40 240 Q82 238 112 254 Q80 252 48 258 Z" fill="#160803"/>
    <path d="M52 276 Q86 270 114 280 Q90 286 64 296 Z" fill="#160803"/>
    <path d="M74 310 Q98 300 120 304 Q102 314 86 324 Z" fill="#160803"/>
    <path d="M118 160 Q134 156 150 160 Q134 166 120 172 Z" fill="#160803"/>`;
  const whites = `
    <ellipse cx="146" cy="150" rx="24" ry="11" transform="rotate(-12 146 150)" fill="url(#${p}-white)" opacity=".95"/>
    <path d="M128 244 Q98 262 72 300 Q110 334 168 336 Q146 304 156 262 Z" fill="url(#${p}-white)"/>
    <path d="M202 318 C176 318 156 330 150 346 C168 360 186 366 202 366 Z" fill="url(#${p}-white)"/>`;
  const eye = `<g class="dt-eye">
      <path d="M104 200 Q122 206 140 216 Q160 220 184 206 L190 214 Q162 236 134 226 Q116 218 104 200 Z" fill="url(#${p}-white)" opacity=".9"/>
      <path d="M104 184 Q124 166 160 176 Q186 186 192 206 Q166 220 132 210 Q112 202 104 184 Z" fill="#140702"/>
      <path d="M111 186 Q128 172 158 180 Q180 188 185 204 Q164 214 134 206 Q118 200 111 186 Z" fill="url(#${p}-iris)"/>
      <ellipse cx="150" cy="195" rx="8" ry="9" fill="#080301"/>
      <circle cx="154" cy="190" r="3.2" fill="#fff"/>
      <circle cx="144" cy="201" r="1.5" fill="#fff" opacity=".6"/>
      <path class="dt-lid" d="M100 180 Q122 160 164 168 Q188 176 196 206 Q176 192 150 186 Q122 180 100 180 Z" fill="url(#${p}-fur)" stroke="#160803" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M98 176 Q128 160 170 170" stroke="#160803" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M186 202 Q192 220 190 236" stroke="#160803" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>`;
  const muzzle = `
      <ellipse cx="170" cy="270" rx="36" ry="27" fill="url(#${p}-white)"/>
      <g fill="#2A1206" opacity=".75"><circle cx="158" cy="262" r="2"/><circle cx="148" cy="270" r="2"/><circle cx="166" cy="272" r="2"/><circle cx="156" cy="280" r="2"/><circle cx="144" cy="282" r="1.8"/><circle cx="170" cy="284" r="1.8"/></g>`;
  const whiskers = `<g class="dt-whisk"><path d="M150 270 Q92 262 22 246 M150 278 Q96 284 26 292 M152 286 Q104 302 40 330 M156 266 Q104 248 52 226" stroke="#FFF8EE" stroke-opacity=".9" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
  return `
  <defs>
    <radialGradient id="${p}-fur" gradientUnits="userSpaceOnUse" cx="200" cy="190" r="210">
      <stop offset="0" stop-color="#FFC266"/><stop offset=".35" stop-color="#F59A24"/><stop offset=".7" stop-color="#D2620F"/><stop offset="1" stop-color="#7A2A07"/>
    </radialGradient>
    <radialGradient id="${p}-white" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F6EEE4"/><stop offset="1" stop-color="#D8C3AC"/></radialGradient>
    <radialGradient id="${p}-earin" cx=".5" cy=".7" r=".7"><stop offset="0" stop-color="#FFF4EC"/><stop offset="1" stop-color="#D9A48E"/></radialGradient>
    <radialGradient id="${p}-iris" cx=".55" cy=".45" r=".6"><stop offset="0" stop-color="#FFF6B0"/><stop offset=".45" stop-color="#F8C840"/><stop offset=".85" stop-color="#C96A06"/><stop offset="1" stop-color="#6B2A05"/></radialGradient>
    <linearGradient id="${p}-nose" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7C1B8"/><stop offset="1" stop-color="#B85F5C"/></linearGradient>
    <radialGradient id="${p}-mouth" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#8E1E22"/><stop offset="1" stop-color="#2B0607"/></radialGradient>
    <radialGradient id="${p}-depth" gradientUnits="userSpaceOnUse" cx="200" cy="210" r="200"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <filter id="${p}-soft"><feGaussianBlur stdDeviation=".7"/></filter>
    <linearGradient id="${p}-bridge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFC266" stop-opacity="0"/><stop offset=".5" stop-color="#FFD49A" stop-opacity=".75"/><stop offset="1" stop-color="#FFC266" stop-opacity="0"/></linearGradient>
    <radialGradient id="${p}-aura" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3D7BF0" stop-opacity=".5"/><stop offset="1" stop-color="#3D7BF0" stop-opacity="0"/></radialGradient>
    <clipPath id="${p}-headclip"><path d="${head}"/><path d="${head}" transform="translate(400 0) scale(-1 1)"/></clipPath>
  </defs>
  <g class="dt-tiger">
  <circle cx="200" cy="200" r="190" fill="url(#${p}-aura)" class="dt-aura"/>
  <ellipse cx="200" cy="378" rx="120" ry="14" fill="#000" opacity=".45"/>
  <g class="dt-body">
    ${both(ear)}
    ${both(`<path d="${head}" fill="url(#${p}-fur)"/>`)}
    ${both(`<path d="${head.replace(/Z\s*$/, '')}" fill="none" stroke="#3B1405" stroke-width="2.5" stroke-linejoin="round"/>`)}
    <g clip-path="url(#${p}-headclip)">
      ${both(fur)}
      ${both(whites)}
      <g filter="url(#${p}-soft)">${both(stripes)}</g>
      <path d="M190 80 Q194 102 202 112 Q206 102 210 80 Q202 90 190 80 Z" fill="#160803"/>
      <path d="M184 112 Q192 124 202 128 Q208 124 216 112 Q202 120 184 112 Z" fill="#160803"/>
      <rect x="0" y="0" width="400" height="400" fill="url(#${p}-depth)"/>
    </g>
    <path d="M172 136 Q162 196 160 234 L240 234 Q238 196 228 136 Q202 128 172 136 Z" fill="url(#${p}-bridge)"/>
    ${both(eye)}
    <g class="dt-mouthin"><path d="M146 282 Q202 300 258 282 Q256 352 202 366 Q148 352 146 282 Z" fill="url(#${p}-mouth)"/>
      <path d="M170 340 Q202 324 234 340 Q226 362 202 364 Q178 362 170 340 Z" fill="#D95B6C"/>
      <path d="M202 330 L202 356" stroke="#A8384A" stroke-width="2"/></g>
    ${both(`<path class="dt-fang" d="M164 282 L182 286 L176 326 Q172 312 164 282 Z" fill="#FFF8E8" stroke="#B5A68C" stroke-width="1"/><path class="dt-fang" d="M184 288 L192 290 L189 300 Z" fill="#F4EBDC"/>`)}
    <g class="dt-jaw">
      ${both(`<path d="M146 302 Q174 296 202 302 L202 356 Q176 356 158 344 Q144 330 146 302 Z" fill="url(#${p}-white)"/><path d="M146 302 Q174 296 202 302" stroke="#3A1208" stroke-width="3" fill="none"/><path class="dt-lfang" d="M166 304 L178 304 L171 284 Z" fill="#FFF8E8" stroke="#B5A68C" stroke-width="1"/>`)}
    </g>
    ${both(muzzle)}
    <path d="M174 226 Q202 218 230 226 Q228 246 202 258 Q176 246 174 226 Z" fill="url(#${p}-nose)" stroke="#3A1208" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M186 236 Q194 242 196 250 M218 236 Q210 242 208 250" stroke="#5A1C14" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M202 258 L202 278 M202 278 Q186 292 166 286 M202 278 Q218 292 238 286" stroke="#2A0E06" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${both(whiskers)}
    <g class="dt-rings"><circle class="dt-ring" cx="202" cy="320" r="40" fill="none" stroke="#FFE7B0" stroke-width="5"/><circle class="dt-ring" cx="202" cy="320" r="40" fill="none" stroke="#9CC3FF" stroke-width="4" style="animation-delay:.35s"/><circle class="dt-ring" cx="202" cy="320" r="40" fill="none" stroke="#FFE7B0" stroke-width="3" style="animation-delay:.7s"/></g>
  </g></g>`;
}

// Chinese-style dragon head, front view, 400x400. Left half drawn once and mirrored.
export function dragonSvg(p: string): string {
  const M = (s: string) => `<g transform="translate(400 0) scale(-1 1)">${s}</g>`;
  const both = (s: string) => s + M(s);
  const flame = `M-20 0 C-26 -26 -12 -46 -10 -74 C-4 -60 4 -54 6 -40 C10 -56 18 -66 24 -78 C28 -48 26 -20 20 0 Z`;
  let mane = '';
  const angles = [150, 166, 182, 197, 212, 227, 242, 257, 270];
  angles.forEach((a, i) => {
    const r = a === 270 ? 92 : 104; const rad = a * Math.PI / 180;
    const x = 200 + r * Math.cos(rad), y = 196 + r * Math.sin(rad);
    const sc = (i % 2 ? 1.25 : 1.05) * (a < 175 ? 0.8 : 1);
    const one = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a + 90}) scale(${sc})"><g class="dt-flick" style="animation-delay:${(i * 0.17).toFixed(2)}s"><path d="${flame}" fill="url(#${p}-flame)"/></g></g>`;
    mane += a === 270 ? one : one + M(one);
  });
  const head = `M202 92 C170 88 138 96 118 112 C100 126 90 146 88 166 C86 190 92 214 104 232 C114 248 124 262 132 272 C150 282 176 287 202 287 Z`;
  const frill = `<path d="M106 148 L56 132 L86 158 L36 166 L82 182 L32 202 L84 208 L44 236 L98 228 L72 262 L116 244 Z" fill="url(#${p}-gold)" stroke="#6B1A0A" stroke-width="2" stroke-linejoin="round"/>
    <path d="M100 160 L70 160 M98 184 L58 190 M100 208 L66 224 M108 230 L90 248" stroke="#7A2E0C" stroke-width="2" opacity=".6"/>`;
  const horn = `<path d="M146 112 C140 84 126 54 98 14 C118 30 134 52 146 74 C150 60 150 46 146 32 C160 48 162 70 156 86 C162 96 168 104 176 108 Z" fill="url(#${p}-horn)" stroke="#5A2A06" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M140 92 Q150 88 156 94 M136 76 Q144 72 150 76 M128 60 Q134 56 140 60" stroke="#6B3A08" stroke-width="2" fill="none" opacity=".7"/>`;
  const brow = `<path d="M96 152 C100 124 136 112 176 126 C186 130 188 140 184 148 C162 138 136 140 116 154 C106 162 98 160 96 152 Z" fill="url(#${p}-gold)" stroke="#6B1A0A" stroke-width="2"/>
    <path d="M100 150 C82 134 80 112 90 92 C92 110 100 124 114 134 Z" fill="url(#${p}-gold)" stroke="#6B1A0A" stroke-width="2"/>
    <path d="M112 140 Q130 128 156 128" stroke="#FFF1B8" stroke-width="2" fill="none" opacity=".8" stroke-linecap="round"/>`;
  const eye = `<g class="dt-eye">
      <ellipse cx="148" cy="172" rx="28" ry="23" fill="#4A050B"/>
      <ellipse cx="148" cy="172" rx="22" ry="18" fill="url(#${p}-deye)"/>
      <ellipse class="dt-pupil" cx="149" cy="172" rx="4" ry="15" fill="#120203"/>
      <ellipse cx="141" cy="164" rx="5" ry="3.5" fill="#fff" opacity=".85"/>
      <path d="M122 184 Q148 200 176 182" stroke="url(#${p}-gold)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path class="dt-lid" d="M118 166 C124 146 168 142 180 164 C166 154 134 154 118 166 Z" fill="#8E1220"/>
    </g>`;
  const whisker = `<g class="dt-whisk"><path d="M128 266 C92 256 58 270 46 300 C36 324 50 352 76 354 C94 354 100 340 92 330 C88 342 70 342 62 326 C54 308 66 284 96 275 C108 272 118 271 128 272 Z" fill="url(#${p}-gold)" stroke="#6B3A08" stroke-width="1.2"/>
    <path d="M124 268 C94 264 70 278 58 300" stroke="#FFF1B8" stroke-width="1.4" fill="none" opacity=".75"/></g>`;
  const curl = `<path d="M134 272 C116 272 106 260 112 248 C118 238 132 242 130 252 C128 258 120 256 122 250" stroke="url(#${p}-gold)" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const jawHalf = `<path d="M128 292 C150 298 176 302 202 302 L202 346 C174 346 150 334 136 314 Z" fill="url(#${p}-skin)"/>
      <path d="M128 292 C150 298 176 302 202 302" stroke="url(#${p}-gold)" stroke-width="4" fill="none"/>
      <path d="M152 300 L164 302 L157 282 Z M172 303 L180 303 L176 290 Z" fill="#FFF6E0" stroke="#B9A27A" stroke-width="1"/>
      <path d="M150 334 C146 352 152 370 164 388 C168 372 172 360 180 350 C182 366 188 380 202 396 L202 344 C182 346 164 342 150 334 Z" fill="url(#${p}-beard)"/>`;
  const fangs = `<path d="M146 284 L162 288 L156 318 Q150 302 146 284 Z" fill="#FFF8E8" stroke="#B9A27A" stroke-width="1"/>
      <path d="M166 288 L176 289 L172 302 Z M180 289 L190 290 L185 300 Z" fill="#F7EEDC" stroke="#B9A27A" stroke-width="1"/>`;
  let embers = '';
  [[60, 300, 2.5, 0], [96, 330, 2, 0.8], [140, 350, 3, 1.6], [250, 340, 2.2, 0.4], [300, 320, 2.8, 1.2], [340, 290, 2, 2], [80, 250, 1.8, 2.4], [326, 240, 2.4, 2.8], [200, 360, 2.6, 3.2], [170, 340, 1.8, 0.2], [236, 352, 2, 2.2], [120, 300, 2.2, 3.6]]
    .forEach(([x, y, r, d]) => { embers += `<circle class="dt-ember" cx="${x}" cy="${y}" r="${r}" fill="#FFD27A" style="animation-delay:${d}s"/>`; });
  let fire = '';
  [122, 146, 168, 192, 214, 238].forEach((a, i) => {
    fire += `<g transform="translate(202 312) rotate(${a}) scale(${i % 2 ? 1.5 : 1.85})"><g class="dt-tongue" style="animation-delay:${(i * 0.06).toFixed(2)}s"><path d="${flame}" fill="url(#${p}-fire)"/></g></g>`;
  });
  return `
  <defs>
    <radialGradient id="${p}-skin" gradientUnits="userSpaceOnUse" cx="200" cy="190" r="190">
      <stop offset="0" stop-color="#FF5A5F"/><stop offset=".4" stop-color="#E0283A"/><stop offset=".8" stop-color="#9E0F1F"/><stop offset="1" stop-color="#5E0712"/>
    </radialGradient>
    <linearGradient id="${p}-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".35" stop-color="#F7C948"/><stop offset=".7" stop-color="#D4901A"/><stop offset="1" stop-color="#8A5208"/></linearGradient>
    <linearGradient id="${p}-horn" x1="0" y1="1" x2=".4" y2="0"><stop offset="0" stop-color="#8A5208"/><stop offset=".4" stop-color="#E9B23A"/><stop offset=".8" stop-color="#FFF0B3"/><stop offset="1" stop-color="#FFFBE6"/></linearGradient>
    <linearGradient id="${p}-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#9F1239"/><stop offset=".45" stop-color="#EA580C"/><stop offset=".8" stop-color="#FBBF24"/><stop offset="1" stop-color="#FEF3C7"/></linearGradient>
    <linearGradient id="${p}-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFFBEB"/><stop offset=".3" stop-color="#FDE047"/><stop offset=".65" stop-color="#F97316"/><stop offset="1" stop-color="#DC2626" stop-opacity=".2"/></linearGradient>
    <linearGradient id="${p}-beard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7C948"/><stop offset=".6" stop-color="#EA580C"/><stop offset="1" stop-color="#B91C1C" stop-opacity=".8"/></linearGradient>
    <radialGradient id="${p}-nose" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#FF5C66"/><stop offset=".6" stop-color="#D21F33"/><stop offset="1" stop-color="#8A0C1B"/></radialGradient>
    <radialGradient id="${p}-deye" cx=".45" cy=".4" r=".65"><stop offset="0" stop-color="#FFFDE0"/><stop offset=".35" stop-color="#FDE047"/><stop offset=".75" stop-color="#F59E0B"/><stop offset="1" stop-color="#B45309"/></radialGradient>
    <radialGradient id="${p}-gem" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#F0FDFF"/><stop offset=".4" stop-color="#67E8F9"/><stop offset="1" stop-color="#0E7490"/></radialGradient>
    <radialGradient id="${p}-mouth" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#7F1D1D"/><stop offset="1" stop-color="#240305"/></radialGradient>
    <radialGradient id="${p}-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#F97316" stop-opacity=".55"/><stop offset="1" stop-color="#F97316" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}-firecore" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBEB"/><stop offset=".4" stop-color="#FDE047" stop-opacity=".9"/><stop offset="1" stop-color="#F97316" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}-depth" gradientUnits="userSpaceOnUse" cx="200" cy="200" r="150"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <pattern id="${p}-scales" width="18" height="12" patternUnits="userSpaceOnUse"><path d="M0 12 Q9 0 18 12 M-9 6 Q0 -6 9 6 M9 6 Q18 -6 27 6" stroke="#FFD27A" stroke-opacity=".35" stroke-width="1.2" fill="none"/></pattern>
    <filter id="${p}-eglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="${p}-headclip"><path d="${head}"/><path d="${head}" transform="translate(400 0) scale(-1 1)"/></clipPath>
  </defs>
  <g class="dt-dragon">
  <circle cx="200" cy="200" r="190" fill="url(#${p}-glow)" class="dt-aura"/>
  <ellipse cx="200" cy="378" rx="120" ry="14" fill="#000" opacity=".45"/>
  <g class="dt-embers">${embers}</g>
  <g class="dt-body">
    <g class="dt-mane">${mane}</g>
    ${both(horn)}
    ${both(frill)}
    <g class="dt-dmouth"><path d="M128 280 C160 296 244 296 276 280 C270 330 238 356 202 358 C166 356 134 330 128 280 Z" fill="url(#${p}-mouth)"/>
      <path d="M176 326 C188 316 216 316 228 326 C226 346 214 354 202 354 C190 354 178 346 176 326 Z" fill="#E25570"/></g>
    <g class="dt-jaw">${both(jawHalf)}</g>
    ${both(`<path d="${head}" fill="url(#${p}-skin)"/>`)}
    <g clip-path="url(#${p}-headclip)">
      <rect x="0" y="0" width="400" height="400" fill="url(#${p}-scales)"/>
      <rect x="0" y="0" width="400" height="400" fill="url(#${p}-depth)"/>
    </g>
    ${both(`<path d="${head.replace(/Z\s*$/, '')}" fill="none" stroke="#4A050B" stroke-width="2.5"/>`)}
    ${[150, 168, 186, 204].map(y => `<path d="M176 ${y} Q202 ${y + 12} 228 ${y} Q202 ${y + 20} 176 ${y} Z" fill="url(#${p}-gold)" stroke="#6B1A0A" stroke-width="1.2"/>`).join('')}
    <g transform="translate(202 118)">
      <path d="M0 -26 C6 -16 14 -14 16 -4 C18 8 10 18 0 20 C-10 18 -18 8 -16 -4 C-14 -14 -6 -16 0 -26 Z" fill="url(#${p}-gold)" stroke="#6B1A0A" stroke-width="2"/>
      <circle r="9" cy="0" fill="url(#${p}-gem)" class="dt-gem"/><circle cx="-3" cy="-3" r="2.5" fill="#fff" opacity=".9"/>
    </g>
    ${both(brow)}
    <g filter="url(#${p}-eglow)">${both(eye)}</g>
    <path d="M176 214 C186 208 218 208 228 214 C244 224 250 244 240 260 C230 272 216 276 202 276 C188 276 174 272 164 260 C154 244 160 224 176 214 Z" fill="url(#${p}-nose)"/>
    <path d="M190 218 Q202 214 214 218 L210 262 Q202 266 194 262 Z" fill="#FF7A80" opacity=".35"/>
    ${both(`<path d="M150 254 C140 236 150 214 174 214 C166 222 162 232 164 246 C166 256 160 260 150 254 Z" fill="url(#${p}-gold)" stroke="#6B1A0A" stroke-width="1.5"/>
      <ellipse cx="176" cy="248" rx="9" ry="5.5" transform="rotate(-28 176 248)" fill="#2A0306"/>
      <path d="M152 236 C150 226 160 220 166 226 C170 230 166 236 162 234" stroke="#FFF1B8" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>`)}
    ${both(`<path d="M120 268 C150 284 176 290 202 290" stroke="url(#${p}-gold)" stroke-width="5" fill="none" stroke-linecap="round"/>`)}
    ${both(fangs)}
    ${both(curl)}
    ${both(whisker)}
    <g class="dt-smoke">${both(`<circle cx="176" cy="240" r="6" fill="#d9d9d9" opacity=".5" class="dt-puff"/><circle cx="170" cy="236" r="4" fill="#e5e5e5" opacity=".4" class="dt-puff" style="animation-delay:1.2s"/>`)}</g>
    <g class="dt-fire"><circle cx="202" cy="318" r="80" fill="url(#${p}-firecore)"/>${fire}</g>
  </g></g>`;
}

/** Wrapper-level motion (breathing, roar, lose) plus the part animations used inside the SVGs. */
export const DT_ART_CSS = `
.dtart{animation:dt-breathe 3.6s ease-in-out infinite;transition:filter .5s,opacity .5s;will-change:transform}
.dtart.dt-tense{animation-duration:1.5s}
.dtart.dt-win{animation:dt-roar 1.3s ease-out forwards}
.dtart.dt-lose{animation:none;transform:scale(.9);filter:grayscale(.85) brightness(.5);transition:transform .5s,filter .5s}
@keyframes dt-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.02)}}
@keyframes dt-roar{0%{transform:scale(1)}12%{transform:scale(1.15) translateY(-8px)}22%{transform:scale(1.1) translate(-4px,-6px) rotate(-2deg)}32%{transform:scale(1.13) translate(4px,-6px) rotate(2deg)}44%{transform:scale(1.1) translate(-2px,-5px) rotate(-1deg)}100%{transform:scale(1.08) translateY(-4px)}}
/* Dragon Tiger creature art. Wrapper: .dtart (+ .dt-tense | .dt-win | .dt-lose | .dt-still) */
.dtart svg{overflow:visible}
.dtart .dt-mouthin,.dtart .dt-fang,.dtart .dt-lfang,.dtart .dt-fire,.dtart .dt-rings{opacity:0}
.dtart .dt-jaw{transition:transform .25s cubic-bezier(.3,1.6,.6,1)}
.dtart.dt-win .dt-mouthin,.dtart.dt-win .dt-fang,.dtart.dt-win .dt-lfang{opacity:1}
.dtart.dt-win .dt-tiger .dt-jaw{transform:translateY(36px)}
.dtart.dt-win .dt-dragon .dt-jaw{transform:translateY(30px)}
.dtart.dt-still.dt-win .dt-fire{opacity:1}

/* idle life */
.dtart .dt-eye{transform-box:fill-box;transform-origin:center;animation:dt-blink 5.5s infinite}
.dtart .dt-dragon .dt-eye{animation-delay:1.3s}
.dtart .dt-pupil{transform-box:fill-box;transform-origin:center;animation:dt-slit 3.2s ease-in-out infinite}
.dtart .dt-tiger .dt-whisk{transform-origin:150px 272px;animation:dt-whisk 2.6s ease-in-out infinite}
.dtart .dt-dragon .dt-whisk{transform-origin:128px 268px;animation:dt-sway 3.4s ease-in-out infinite}
.dtart .dt-ear{transform-origin:124px 110px;animation:dt-ear 7s ease-in-out infinite}
.dtart .dt-flick{transform-origin:0 0;animation:dt-flick 1.3s ease-in-out infinite alternate}
.dtart .dt-aura{transform-origin:200px 200px;animation:dt-aura 2.8s ease-in-out infinite}
.dtart .dt-gem{animation:dt-gem 2.2s ease-in-out infinite}
.dtart .dt-puff{transform-box:fill-box;transform-origin:center;animation:dt-puff 3.2s ease-out infinite}
.dtart .dt-ember{transform-box:fill-box;transform-origin:center;animation:dt-ember 4s linear infinite}
/* tension while cards are dealt */
.dtart.dt-tense .dt-flick{animation-duration:.6s}
.dtart.dt-tense .dt-aura{animation-duration:1s}
.dtart.dt-tense .dt-whisk{animation-duration:1.2s}
/* result */
.dtart.dt-win .dt-fire{opacity:1;transform-origin:202px 300px;animation:dt-fire 1.6s ease-out infinite}
.dtart.dt-win .dt-tongue{transform-origin:0 0;animation:dt-tongue .35s ease-in-out infinite alternate}
.dtart.dt-win .dt-rings{opacity:1}
.dtart.dt-win .dt-ring{transform-box:fill-box;transform-origin:center;animation:dt-ring 1.4s ease-out infinite}
.dtart.dt-win .dt-flick{animation-duration:.45s}

@keyframes dt-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes dt-slit{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.55)}}
@keyframes dt-whisk{0%,100%{transform:rotate(0)}50%{transform:rotate(-3deg)}}
@keyframes dt-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
@keyframes dt-ear{0%,84%,100%{transform:rotate(0)}87%{transform:rotate(-10deg)}90%{transform:rotate(4deg)}93%{transform:rotate(0)}}
@keyframes dt-flick{from{transform:scaleY(.92) skewX(-3deg)}to{transform:scaleY(1.1) skewX(4deg)}}
@keyframes dt-aura{0%,100%{opacity:.65;transform:scale(.96)}50%{opacity:1;transform:scale(1.04)}}
@keyframes dt-gem{0%,100%{opacity:.85}50%{opacity:1;filter:brightness(1.5)}}
@keyframes dt-puff{0%{transform:translate(0,0) scale(.5);opacity:0}15%{opacity:.55}100%{transform:translate(-12px,-70px) scale(2.6);opacity:0}}
@keyframes dt-ember{0%{transform:translate(0,0);opacity:0}10%{opacity:1}100%{transform:translate(8px,-230px);opacity:0}}
@keyframes dt-fire{0%{transform:scale(.25);opacity:0}15%{transform:scale(1);opacity:1}70%{opacity:1}100%{transform:scale(1.12);opacity:0}}
@keyframes dt-tongue{from{transform:scaleY(.85)}to{transform:scaleY(1.12)}}
@keyframes dt-ring{0%{transform:scale(.4);opacity:.9}100%{transform:scale(3.2);opacity:0}}
@media (prefers-reduced-motion:reduce){.dtart *{animation:none!important}}
.dtart.dt-still *{animation:none!important;transition:none!important}
.dtart.dt-still .dt-rings{opacity:0!important}
`;
