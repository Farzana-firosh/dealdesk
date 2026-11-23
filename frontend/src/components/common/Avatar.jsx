// muted tones that sit with the slate/steel palette and keep white initials readable
const COLORS = ['#354B60', '#5f7f99', '#2f6e99', '#1f7a55', '#9a5d1a', '#7a4f6b', '#4b5f71', '#101820'];

const initials = (name = '?') =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

// Colour derived from the name so the same person always gets the same colour.
const colorFor = (name = '') => COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

export default function Avatar({ name, size = 32, online }) {
  return (
    <span className={`avatar${online ? ' online' : ''}`} style={{ width: size, height: size, fontSize: size * 0.38, background: colorFor(name) }}>
      {initials(name)}
    </span>
  );
}
