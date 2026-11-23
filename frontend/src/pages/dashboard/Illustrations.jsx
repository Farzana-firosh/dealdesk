// Small flat illustrations for the dashboard's quick cards, drawn in the palette
// (ink #101820 · slate #354B60 · steel #7394AC · mist #B8D0DE · cloud #F0F5F7, warm accent #D9A35B).
// Decorative only, so hidden from screen readers.

const Frame = ({ children }) => (
  <svg viewBox="0 0 160 96" aria-hidden="true" className="illo">
    <circle cx="128" cy="22" r="26" fill="#F0F5F7" opacity=".9" />
    <circle cx="26" cy="80" r="22" fill="#B8D0DE" opacity=".45" />
    {children}
  </svg>
);

// stacked deal sheets with a plus badge
export const NewDealArt = () => (
  <Frame>
    <rect x="46" y="22" width="52" height="62" rx="6" fill="#B8D0DE" transform="rotate(-8 72 53)" />
    <rect x="54" y="16" width="52" height="64" rx="6" fill="#fff" stroke="#B8D0DE" />
    <rect x="62" y="28" width="30" height="5" rx="2.5" fill="#354B60" />
    <rect x="62" y="40" width="36" height="4" rx="2" fill="#B8D0DE" />
    <rect x="62" y="50" width="28" height="4" rx="2" fill="#B8D0DE" />
    <rect x="62" y="62" width="20" height="8" rx="3" fill="#7394AC" />
    <circle cx="106" cy="72" r="13" fill="#354B60" />
    <path d="M106 66v12M100 72h12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
  </Frame>
);

// a request moving through three approval steps
export const ApprovalsArt = () => (
  <Frame>
    <rect x="40" y="18" width="80" height="64" rx="8" fill="#fff" stroke="#B8D0DE" />
    {[30, 48, 66].map((y, i) => (
      <g key={y}>
        <circle cx="54" cy={y} r="6" fill={i < 2 ? '#354B60' : '#F0F5F7'} stroke={i < 2 ? 'none' : '#B8D0DE'} />
        {i < 2 && <path d={`M51 ${y}l2 2.4 4-4.4`} stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />}
        <rect x="66" y={y - 3} width={i === 2 ? 30 : 42} height="6" rx="3" fill={i < 2 ? '#7394AC' : '#B8D0DE'} />
      </g>
    ))}
    <circle cx="116" cy="70" r="14" fill="#D9A35B" opacity=".9" />
    <path d="M110 70l4 4 8-8" stroke="#101820" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

// an invoice with a paid stamp and coins
export const InvoicesArt = () => (
  <Frame>
    <path d="M50 14h48l12 12v60l-6-4-6 4-6-4-6 4-6-4-6 4-6-4-6 4-6-4-6 4z" fill="#fff" stroke="#B8D0DE" />
    <path d="M98 14v12h12" fill="#F0F5F7" stroke="#B8D0DE" />
    <rect x="60" y="32" width="28" height="5" rx="2.5" fill="#354B60" />
    <rect x="60" y="44" width="40" height="4" rx="2" fill="#B8D0DE" />
    <rect x="60" y="54" width="32" height="4" rx="2" fill="#B8D0DE" />
    <rect x="72" y="64" width="34" height="12" rx="3" fill="none" stroke="#1f8a5b" strokeWidth="2" transform="rotate(-10 89 70)" />
    <text x="89" y="73" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1f8a5b" transform="rotate(-10 89 70)" letterSpacing="1">PAID</text>
    <ellipse cx="120" cy="80" rx="12" ry="4" fill="#B08544" />
    <rect x="108" y="70" width="24" height="10" fill="#D9A35B" />
    <ellipse cx="120" cy="70" rx="12" ry="4" fill="#E6BC7E" />
  </Frame>
);

// two chat bubbles
export const ChatArt = () => (
  <Frame>
    <rect x="34" y="20" width="66" height="34" rx="12" fill="#fff" stroke="#B8D0DE" />
    <path d="M46 54l-4 10 14-10" fill="#fff" stroke="#B8D0DE" />
    <rect x="44" y="30" width="40" height="5" rx="2.5" fill="#7394AC" />
    <rect x="44" y="40" width="28" height="5" rx="2.5" fill="#B8D0DE" />
    <rect x="70" y="48" width="62" height="30" rx="12" fill="#354B60" />
    <path d="M120 78l6 9-14-9" fill="#354B60" />
    <circle cx="88" cy="63" r="3" fill="#F0F5F7" />
    <circle cx="100" cy="63" r="3" fill="#F0F5F7" />
    <circle cx="112" cy="63" r="3" fill="#F0F5F7" />
  </Frame>
);

// a stack of deal containers
export const DealsArt = () => (
  <Frame>
    {[
      [44, 56, '#7394AC'], [72, 56, '#F0F5F7'], [100, 56, '#D9A35B'],
      [58, 34, '#B8D0DE'], [86, 34, '#354B60'],
    ].map(([x, y, fill]) => (
      <g key={`${x}-${y}`}>
        <rect x={x} y={y} width="26" height="20" rx="2" fill={fill} stroke="rgba(16,24,32,.25)" />
        <path d={`M${x + 7} ${y + 4}v12M${x + 13} ${y + 4}v12M${x + 19} ${y + 4}v12`} stroke="rgba(16,24,32,.18)" />
      </g>
    ))}
    <rect x="36" y="76" width="98" height="6" rx="3" fill="#101820" />
  </Frame>
);
