// Decorative night-harbour scene for the sign-in card: a container ship heading for port.
// With `departing` the ship sails on into port (sign-in succeeded). Hidden from screen readers.
// Everything that moves is its own HTML layer animated with transform, so the browser can
// composite it instead of repainting the whole SVG on every frame.

// deterministic star field: [x, y, r, opacity]
const STARS = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 97) % 640;
  const y = (i * 53 + (i % 7) * 31) % 330;
  return [x, y, i % 9 === 0 ? 1.1 : 0.6, i % 5 === 0 ? 0.75 : 0.35];
});

// container colours: muted steel tones with one warm accent
const BOX = ['#5f7f99', '#8fa9bd', '#3e566b', '#b9cbd8', '#4b6a83', '#b8894f', '#7394ac'];
const STACKS = [4, 5, 5, 4, 5, 6, 5, 4, 5, 5, 4, 3];

function Sky() {
  return (
    <svg className="scene-sky" viewBox="0 0 640 640" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b131b" />
          <stop offset=".45" stopColor="#17242f" />
          <stop offset=".62" stopColor="#3d5870" />
          <stop offset="1" stopColor="#101820" />
        </linearGradient>
        <radialGradient id="horizonGlow" cx=".7" cy=".6" r=".5">
          <stop offset="0" stopColor="#B8D0DE" stopOpacity=".35" />
          <stop offset="1" stopColor="#B8D0DE" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonHalo">
          <stop offset="0" stopColor="#F0F5F7" stopOpacity=".35" />
          <stop offset=".5" stopColor="#B8D0DE" stopOpacity=".08" />
          <stop offset="1" stopColor="#B8D0DE" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon" cx=".38" cy=".35" r=".7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9d9e4" />
        </radialGradient>
      </defs>
      <rect width="640" height="640" fill="url(#sky)" />
      <rect width="640" height="640" fill="url(#horizonGlow)" />
      {STARS.map(([x, y, r, o]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#F0F5F7" opacity={o} />)}
      <circle cx="430" cy="140" r="120" fill="url(#moonHalo)" />
      <circle cx="430" cy="140" r="30" fill="url(#moon)" />

      {/* the distant port on the horizon, with its lights (scaled about its base line) */}
      <g transform="translate(196 154) scale(.6)">
      <g fill="#1a2733">
        <rect x="452" y="378" width="188" height="8" />
        <rect x="466" y="362" width="26" height="16" />
        <rect x="610" y="356" width="30" height="22" />
        {[500, 546, 592].map((x) => (
          <g key={x}>
            <rect x={x} y="328" width="2.5" height="50" />
            <rect x={x + 16} y="328" width="2.5" height="50" />
            <rect x={x - 26} y="324" width="62" height="3.5" />
            <path d={`M${x + 1} 324 L${x + 9} 306 L${x + 17} 324`} fill="none" stroke="#1a2733" strokeWidth="2" />
          </g>
        ))}
      </g>
      <g fill="#E9C27D">
        {[501, 547, 593].map((x) => <circle key={x} cx={x + 8} cy="305" r="1.6" opacity=".9" />)}
        {[470, 486, 520, 560, 600, 624].map((x) => <circle key={x} cx={x} cy="381" r="1.4" opacity=".75" />)}
      </g>
      </g>
    </svg>
  );
}

// A strip two tiles wide (1280 units); the layer slides left by half its width, which is a whole number of periods.
function Wave({ name, amp, periods, colors, crest }) {
  const period = 1280 / periods;
  let line = 'M0 40';
  for (let i = 0; i < periods * 2; i += 1) {
    const x = (i * period) / 2;
    line += ` Q${x + period / 4} ${i % 2 === 0 ? 40 - amp : 40 + amp} ${x + period / 2} 40`;
  }
  return (
    <div className={`wave ${name}`}>
      <svg viewBox="0 0 1280 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${name}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="1" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <path d={`${line} V200 H0 Z`} fill={`url(#g-${name})`} />
        <path d={line} fill="none" stroke={crest} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Containers() {
  return STACKS.flatMap((height, bay) =>
    Array.from({ length: height }, (_, tier) => {
      const x = 86 + bay * 23;
      const y = 72 - (tier + 1) * 12;
      return (
        <g key={`${bay}-${tier}`}>
          <rect x={x} y={y} width="21.5" height="11.5" fill={BOX[(bay * 3 + tier * 5) % BOX.length]} />
          <rect x={x} y={y} width="21.5" height="1.4" fill="#ffffff" opacity=".18" />
          <rect x={x} y={y + 9.5} width="21.5" height="2" fill="#0b1117" opacity=".25" />
        </g>
      );
    }),
  );
}

function ShipBody() {
  return (
    <g>
      {/* accommodation block and bridge at the stern */}
      <path d="M40 18 L43 -6 L59 -6 L62 18 Z" fill="#2f4356" />
      <rect x="42" y="-6" width="18" height="4" fill="#1b2833" />
      <path d="M51 -6 V-26" stroke="#8fa9bd" strokeWidth="1.2" />
      <circle cx="51" cy="-27" r="1.6" fill="#F0F5F7" />
      <rect x="22" y="18" width="50" height="54" fill="url(#house)" />
      <rect x="16" y="15" width="62" height="5" fill="#c9d6df" />
      <rect x="25" y="23" width="44" height="5" fill="#1b2833" />
      {[34, 44, 54, 64].map((y, row) =>
        [27, 35, 43, 51, 59].map((x, i) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="5" height="3" fill={(row + i) % 3 === 0 ? '#E9C27D' : '#3e566b'} opacity={(row + i) % 3 === 0 ? 0.95 : 0.7} />
        )),
      )}

      <Containers />

      {/* forward mast */}
      <path d="M384 70 V34" stroke="#8fa9bd" strokeWidth="1.2" />
      <circle cx="384" cy="33" r="1.6" fill="#F0F5F7" />

      {/* hull: flat stern, flared bow, dark boot-top along the waterline */}
      <path d="M6 72 H368 Q392 70 406 61 L399 86 Q392 101 371 104 H30 Q13 104 9 95 Z" fill="url(#hull)" />
      <path d="M12 95 H388 Q382 103 371 104 H30 Q16 104 12 95 Z" fill="#3e566b" />
      <path d="M8 72 H368 Q392 70 406 61" fill="none" stroke="#7394AC" strokeWidth="1.2" opacity=".75" />
      <text x="330" y="86" fontSize="7" letterSpacing="3" fill="#8fa9bd" opacity=".85" fontWeight="600">DEALDESK</text>
      <circle cx="398" cy="78" r="1.4" fill="#5fbf8f" />
    </g>
  );
}

function Ship() {
  return (
    <svg viewBox="-6 -34 420 176" className="ship-svg">
      <defs>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2a36" />
          <stop offset="1" stopColor="#0b1117" />
        </linearGradient>
        <linearGradient id="house" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#aebfcc" />
          <stop offset=".5" stopColor="#e3ebf0" />
          <stop offset="1" stopColor="#b7c7d3" />
        </linearGradient>
        <linearGradient id="reflectionFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="reflectionMask"><rect x="-10" y="104" width="430" height="40" fill="url(#reflectionFade)" /></mask>
      </defs>
      <ShipBody />
      {/* a faint mirror image in the water */}
      <g mask="url(#reflectionMask)" opacity=".35">
        <g transform="translate(0 208) scale(1 -1)"><ShipBody /></g>
      </g>
      {/* wake trailing from the stern */}
      <path d="M8 102 Q-20 104 -40 101 M14 106 Q-14 109 -30 107" stroke="#B8D0DE" strokeWidth="1.2" opacity=".35" fill="none" />
    </svg>
  );
}

export default function ShipScene({ departing }) {
  return (
    <div className={`scene${departing ? ' is-departing' : ''}`} aria-hidden="true">
      <Sky />
      <Wave name="wave-back" amp={5} periods={6} colors={['#2e4457', '#1b2a37']} crest="rgba(184,208,222,.28)" />
      <div className="ship"><div className="ship-bob"><Ship /></div></div>
      <Wave name="wave-mid" amp={4} periods={8} colors={['#1d2b38', '#111a22']} crest="rgba(184,208,222,.18)" />
      <Wave name="wave-front" amp={6} periods={5} colors={['#152029', '#0b1117']} crest="rgba(184,208,222,.14)" />
    </div>
  );
}
