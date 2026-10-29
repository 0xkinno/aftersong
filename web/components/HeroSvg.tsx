/** A record half out of its sleeve, three ember lines to three small things from a life. Inline, no external assets. Drawn for the dark hero stage. */
export default function HeroSvg({ className = "" }: { className?: string }) {
  const grooves = Array.from({ length: 12 }, (_, i) => 52 + i * 8.5);
  const light = "#f6f1e8";
  const mono = "var(--font-jetbrains), monospace";
  return (
    <svg viewBox="0 0 600 600" className={className} role="img" aria-label="A vinyl record half out of a paper sleeve labelled 1950 to 1970, with three lines leading to a film reel, a bowl and a transistor radio" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <radialGradient id="rec" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2b2621" />
          <stop offset="1" stopColor="#14110e" />
        </radialGradient>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#e8692c" stopOpacity="0.42" />
          <stop offset="1" stopColor="#e8692c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} stopOpacity="0.5" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sleeve" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a342d" />
          <stop offset="1" stopColor="#24201b" />
        </linearGradient>
      </defs>
      <circle cx="340" cy="290" r="270" fill="url(#halo)" stroke="none" />
      {/* record */}
      <g transform="rotate(-8 340 290)">
        <g className="spin" style={{ transformOrigin: "340px 290px" }}>
          <circle cx="340" cy="290" r="190" fill="url(#rec)" stroke={light} strokeOpacity="0.55" />
          {grooves.map((r, i) => (
            <circle key={r} cx="340" cy="290" r={r * 1.55} stroke={light} strokeOpacity={i % 3 === 0 ? 0.28 : 0.12} />
          ))}
          <path d="M340 130 A160 160 0 0 1 480 215" stroke="url(#sheen)" strokeWidth="14" strokeOpacity="0.5" />
          <path d="M340 450 A160 160 0 0 1 200 365" stroke="url(#sheen)" strokeWidth="14" strokeOpacity="0.35" />
          <circle cx="340" cy="290" r="52" fill="#e8692c" stroke="none" />
          <circle cx="340" cy="290" r="52" stroke="#f4a35b" strokeOpacity="0.6" />
          <path d="M318 290 H362" stroke="#14110e" strokeOpacity="0.35" />
        </g>
        <circle cx="340" cy="290" r="5" fill="#14110e" stroke={light} strokeOpacity="0.5" />
      </g>
      {/* sleeve covering the left half */}
      <g transform="rotate(-8 170 340)">
        <rect x="52" y="150" width="268" height="360" rx="10" fill="url(#sleeve)" stroke={light} strokeOpacity="0.55" />
        <path d="M52 196 H320" stroke={light} strokeOpacity="0.18" />
        <rect x="84" y="364" width="204" height="70" rx="5" fill="#14110e" stroke={light} strokeOpacity="0.35" />
        <text x="186" y="392" textAnchor="middle" fontFamily={mono} fontSize="12" letterSpacing="2.4" fill={light} fillOpacity="0.75" stroke="none">TO REMEMBER</text>
        <text x="186" y="418" textAnchor="middle" fontFamily={mono} fontSize="17" letterSpacing="2.2" fill="#f4a35b" stroke="none">1950 TO 1970</text>
      </g>
      {/* constellation */}
      <g stroke="#f4a35b">
        <path d="M468 214 C506 188 520 150 544 112" strokeDasharray="3 5" />
        <path d="M512 296 C536 300 552 312 560 332" strokeDasharray="3 5" />
        <path d="M456 392 C488 432 478 476 450 520" strokeDasharray="3 5" />
        <circle cx="468" cy="214" r="4.5" fill="#f4a35b" />
        <circle cx="512" cy="296" r="4.5" fill="#f4a35b" />
        <circle cx="456" cy="392" r="4.5" fill="#f4a35b" />
      </g>
      <g stroke={light} fill="#14110e">
        {/* film reel */}
        <g transform="translate(548 84)">
          <circle r="28" />
          <circle r="6" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={14 * Math.cos((a * Math.PI) / 180)} cy={14 * Math.sin((a * Math.PI) / 180)} r="4" />
          ))}
          <text y="48" textAnchor="middle" fontFamily={mono} fontSize="11" letterSpacing="1.6" fill={light} stroke="none">FILM</text>
        </g>
        {/* bowl */}
        <g transform="translate(560 352)">
          <path d="M-28 -4 H28 C28 18 14 28 0 28 C-14 28 -28 18 -28 -4 Z" />
          <path d="M-16 -14 C-10 -26 -2 -10 3 -20 C8 -28 13 -12 16 -18" strokeOpacity="0.7" />
          <text y="50" textAnchor="middle" fontFamily={mono} fontSize="11" letterSpacing="1.6" fill={light} stroke="none">FOOD</text>
        </g>
        {/* transistor radio */}
        <g transform="translate(446 536)">
          <rect x="-32" y="-20" width="64" height="40" rx="6" />
          <circle cx="-12" cy="0" r="10" />
          <path d="M8 -8 H22 M8 0 H22 M8 8 H22" />
          <path d="M-18 -20 L10 -38" />
          <text y="42" textAnchor="middle" fontFamily={mono} fontSize="11" letterSpacing="1.6" fill={light} stroke="none">RADIO</text>
        </g>
      </g>
    </svg>
  );
}
