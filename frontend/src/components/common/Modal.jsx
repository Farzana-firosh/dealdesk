import { useEffect, useId, useRef } from 'react';
import Button from './Button';

/**
 * Dialog shell: centred for short confirmations, or a side drawer (`drawer`) for longer forms.
 * Escape and a click on the backdrop close it; focus moves into it on open and back on close.
 */
export default function Modal({ title, subtitle, open, onClose, footer, size, drawer = false, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  // callers pass inline handlers; reading the latest through a ref keeps the effect to open/close only
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    // focus the first field (or the panel) unless a child already took focus with autoFocus
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      (panel.querySelector('input:not([disabled]), textarea:not([disabled]), button.select-trigger:not([disabled])') ?? panel).focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const classes = ['modal', drawer && 'drawer', size === 'lg' && 'modal-lg'].filter(Boolean).join(' ');

  return (
    <div className={`modal-backdrop${drawer ? ' is-drawer' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className={classes} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-header">
          <h3 id={titleId}>
            {title}
            {subtitle && <span className="modal-sub">{subtitle}</span>}
          </h3>
          <Button variant="ghost" icon="x" onClick={onClose} aria-label="Close" />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export const Drawer = (props) => <Modal {...props} drawer />;
