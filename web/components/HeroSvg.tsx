/** A record half out of its sleeve, three ember lines to three small things from a life. Inline, no external assets. */
export default function HeroSvg({ className = "" }: { className?: string }) {
  const grooves = Array.from({ length: 9 }, (_, i) => 44 + i * 11);
  return (
    <svg viewBox="0 0 520 520" className={className} role="img" aria-label="A vinyl record half out of a paper sleeve labelled 1952 to 1972, with three lines leading to a film reel, a bowl and a transistor radio" fill="none" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--ink)">
        {/* record, tilted */}
        <g transform="rotate(-10 300 260)">
          <circle cx="300" cy="260" r="150" fill="var(--paper)" />
          {grooves.map((r) => (
            <circle key={r} cx="300" cy="260" r={r} opacity={r % 22 === 0 ? 0.55 : 0.28} />
          ))}
          <circle cx="300" cy="260" r="40" stroke="var(--ember)" fill="var(--paper)" />
          <circle cx="300" cy="260" r="4" fill="var(--ink)" />
        </g>
        {/* sleeve covering the left half */}
        <g transform="rotate(-10 150 300)">
          <rect x="56" y="150" width="228" height="300" rx="6" fill="var(--paper-2)" />
          <path d="M56 188 H284" opacity="0.4" />
          <rect x="84" y="318" width="168" height="54" rx="3" fill="var(--paper)" />
          <text x="168" y="342" textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="11" letterSpacing="1.4" fill="var(--ink)" stroke="none">TO REMEMBER</text>
          <text x="168" y="360" textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="13" letterSpacing="1.4" fill="var(--ember-text)" stroke="none">1952 TO 1972</text>
        </g>
      </g>
      {/* constellation */}
      <g stroke="var(--ember)">
        <path d="M388 196 C420 170 430 140 452 110" />
        <path d="M444 262 C470 266 488 276 500 292" />
        <path d="M410 346 C430 386 420 420 400 452" />
        <circle cx="388" cy="196" r="3" fill="var(--ember)" />
        <circle cx="444" cy="262" r="3" fill="var(--ember)" />
        <circle cx="410" cy="346" r="3" fill="var(--ember)" />
      </g>
      <g stroke="var(--ink)" fill="var(--paper)">
        {/* film reel */}
        <g transform="translate(452 84)">
          <circle r="22" />
          <circle r="5" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={11 * Math.cos((a * Math.PI) / 180)} cy={11 * Math.sin((a * Math.PI) / 180)} r="3.2" />
          ))}
          <text y="40" textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="10" letterSpacing="1.2" fill="var(--ink)" stroke="none">FILM</text>
        </g>
        {/* bowl */}
        <g transform="translate(496 306)">
          <path d="M-22 -4 H22 C22 14 10 22 0 22 C-10 22 -22 14 -22 -4 Z" />
          <path d="M-12 -12 C-8 -20 -2 -8 2 -16 C6 -22 10 -10 12 -14" opacity="0.7" />
          <text y="42" textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="10" letterSpacing="1.2" fill="var(--ink)" stroke="none">FOOD</text>
        </g>
        {/* transistor radio */}
        <g transform="translate(396 470)">
          <rect x="-26" y="-16" width="52" height="32" rx="5" />
          <circle cx="-10" cy="0" r="8" />
          <path d="M6 -6 H18 M6 0 H18 M6 6 H18" />
          <path d="M-14 -16 L8 -30" />
          <text y="34" textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="10" letterSpacing="1.2" fill="var(--ink)" stroke="none">RADIO</text>
        </g>
      </g>
    </svg>
  );
}
