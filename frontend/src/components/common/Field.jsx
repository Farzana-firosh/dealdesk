// Label + hint/error wrapper shared by Input, Select and TextArea.
// `messageId` lets the control point at the hint/error text with aria-describedby.
export default function Field({ label, hint, error, htmlFor, aside, messageId, children }) {
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
      {error ? (
        <span id={messageId} className="field-error">{error}</span>
      ) : (
        hint && <span id={messageId} className="field-hint">{hint}</span>
      )}
    </div>
  );
}
