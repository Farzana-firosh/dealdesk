import { useEffect } from 'react';

/** Calls onDismiss when the user clicks outside `ref` or presses Escape, while `open`. For dropdown menus. */
export default function useDismiss(ref, open, onDismiss) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => ref.current && !ref.current.contains(e.target) && onDismiss();
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onDismiss]);
}
