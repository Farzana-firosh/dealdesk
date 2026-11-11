const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#2563eb', '#475569'];

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
