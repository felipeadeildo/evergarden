import { type RefObject, useEffect, useRef } from "react";

/**
 * Opens and closes a <dialog> as a modal to follow `open`. Opening focuses the child marked
 * `data-autofocus`; a click on the backdrop, which lands on the dialog itself, calls `onBackdrop`.
 */
export function useModal(
  open: boolean,
  onBackdrop?: () => void,
): RefObject<HTMLDialogElement | null> {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !onBackdrop) return undefined;
    function onClick(event: MouseEvent) {
      if (event.target === element) onBackdrop?.();
    }
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [onBackdrop]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      element.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  return dialog;
}
