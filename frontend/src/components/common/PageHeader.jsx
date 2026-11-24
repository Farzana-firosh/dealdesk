/** The card at the top of every list page: the title, then the page's filters and actions. */
export default function PageHeader({ title, children }) {
  return (
    <div className="card page-header">
      <h2>{title}</h2>
      <span className="spacer" />
      {children}
    </div>
  );
}
