import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Field from './Field';
import Icon from './Icon';

/**
 * Styled dropdown (listbox) with keyboard support.
 * options: [{ value, label }]. onChange receives { target: { value } } like a native select.
 * The menu is rendered in a portal with fixed positioning, so a scrolling modal body never clips it.
 */
export default function Select({ label, hint, error, options = [], placeholder, value = '', onChange, disabled }) {
  const id = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);

  const items = placeholder ? [{ value: '', label: placeholder }, ...options] : options;
  const selected = items.find((o) => String(o.value) === String(value));
  const selectedIndex = items.indexOf(selected);

  const openMenu = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (index) => {
    const item = items[index];
    if (item) onChange?.({ target: { value: item.value } });
    close();
    triggerRef.current?.focus();
  };

  // Place the menu under the trigger, or above it when there is no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = Math.min(items.length * 36 + 8, 248);
    const below = window.innerHeight - rect.bottom >= menuHeight + 8 || rect.top < menuHeight + 8;
    setPosition({ left: rect.left, width: rect.width, top: below ? rect.bottom + 4 : rect.top - menuHeight - 4 });
  }, [open, items.length]);

  // Close on outside click, page scroll or resize (the menu would no longer line up).
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close();
    };
    const scroll = (e) => { if (!menuRef.current?.contains(e.target)) close(); };
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Keep the highlighted option visible while moving with the keyboard.
  useEffect(() => {
    if (open) menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(items.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close();
    else if (e.key.length === 1) {
      // type-ahead: jump to the first option starting with the typed letter
      const index = items.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (index >= 0) setActive(index);
    }
  };

  const listId = `${id}-list`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className={`control${error ? ' has-error' : ''}${open ? ' is-open' : ''}`}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`select-trigger${selected && selected.value !== '' ? '' : ' is-placeholder'}`}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          disabled={disabled}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={onKeyDown}
        >
          <span className="select-value">{selected ? selected.label : placeholder || 'Select…'}</span>
        </button>
        <Icon name="caret" size={16} className="select-caret" />
      </div>

      {open && position && createPortal(
        <ul ref={menuRef} id={listId} role="listbox" className="select-menu" style={position}>
          {items.map((o, i) => {
            const isSelected = o === selected;
            return (
              <li
                key={`${o.value}`}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                className={`select-option${i === active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}${o.value === '' ? ' is-placeholder' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus on the trigger
                onClick={() => choose(i)}
              >
                <span className="select-option-label">{o.label}</span>
                {isSelected && <Icon name="check" size={16} />}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </Field>
  );
}
