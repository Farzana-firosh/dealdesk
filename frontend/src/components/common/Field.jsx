// Label + hint/error wrapper shared by Input, Select and TextArea.
export default function Field({ label, hint, error, htmlFor, aside, children }) {
  return (
    <div className="field">
      {(label || aside) && (
        <div className="row">
          {label && <label className="field-label" htmlFor={htmlFor}>{label}</label>}
          {aside && <span className="spacer" />}
          {aside}
        </div>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
