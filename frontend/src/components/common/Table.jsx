import EmptyState from './EmptyState';

/**
 * columns: [{ key, header, render?(row), align? }]
 * Keeps every list page consistent (header style, empty state, horizontal scroll on mobile).
 */
export default function Table({ columns, rows, rowKey = '_id', empty = 'Nothing here yet', loading }) {
  if (loading) return <div className="empty">Loading…</div>;
  if (!rows?.length) return <EmptyState title={empty} />;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align }}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
