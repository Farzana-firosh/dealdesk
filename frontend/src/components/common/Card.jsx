export default function Card({ title, actions, children, padded = true, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <span className="card-title">{title}</span>
          <span className="spacer" />
          {actions}
        </div>
      )}
      {padded ? <div className="card-body">{children}</div> : children}
    </div>
  );
}
