import Button from './Button';

/** Footer for a paged list: "21–40 of 57 deals" and previous/next. Hidden when the list is empty. */
export default function Pagination({ page, pages, total, limit, noun = 'item', onChange }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="pager">
      <span className="muted">{from}–{to} of {total} {noun}{total === 1 ? '' : 's'}</span>
      <span className="spacer" />
      {pages > 1 && (
        <>
          <Button size="sm" variant="ghost" icon="arrowLeft" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" />
          <span className="pager-page">Page {page} of {pages}</span>
          <Button size="sm" variant="ghost" icon="arrowRight" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page" />
        </>
      )}
    </div>
  );
}
