/** A headline number: label, value and an optional sub line. `tone` colours the small accent bar. */
export default function StatCard({ label, value, sub, tone = 'primary' }) {
  return (
    <div className={`card stat stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <div className="stat-value">{value}</div>
      {sub && <div className="cell-sub">{sub}</div>}
    </div>
  );
}
