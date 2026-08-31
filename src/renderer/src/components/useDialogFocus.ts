import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function useDialogFocus<T extends HTMLElement>(
  active = true,
  returnTarget?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusTarget =
      returnTarget?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0])?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = focusable();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', keepFocusInside);
    return () => {
      dialog.removeEventListener('keydown', keepFocusInside);
      if (focusTarget?.isConnected) focusTarget.focus();
    };
  }, [active, returnTarget]);

  return dialogRef;
}
